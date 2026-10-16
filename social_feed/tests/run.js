// tests/run.js — запуск: node scripts/social_feed/tests/run.js (из корня vault или откуда угодно).
// Загружает модули тем же загрузчиком, что и Obsidian, и прогоняет юнит- и дымовые тесты.
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { install } = require("./fake-dom");
const { makeDv, makeApp } = require("./fixtures");

const SRC = path.resolve(__dirname, "..");
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), "sf-vault-"));
const ROOT = "scripts/social_feed";
fs.cpSync(SRC, path.join(VAULT, ROOT), { recursive: true });

let passed = 0, failed = 0;
const readDb = () => JSON.parse(fs.readFileSync(path.join(VAULT, ROOT, "data/social_feed.json"), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const test = async (name, fn) => { try { await fn(); passed++; console.log("  ok  ", name); } catch (e) { failed++; console.log("  FAIL", name, "\n      ", e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n       ") : e); } };

(async () => {
  install();
  const app = makeApp(VAULT);
  const loaderMod = { exports: {} };
  new Function("module", "exports", fs.readFileSync(path.join(SRC, "core/loader.js"), "utf8"))(loaderMod, loaderMod.exports);
  const { require: R, ids } = await loaderMod.exports({ app, root: ROOT }).load();
  console.log(`модулей загружено: ${ids.length}`);

  console.log("\nunit");
  await test("date.toMs: форматы", () => {
    const D = R("lib/date");
    assert.strictEqual(D.toMs("2025-05-14 16:42"), new Date(2025, 4, 14, 16, 42).getTime());
    assert.strictEqual(D.toMs("14.05.2025"), new Date(2025, 4, 14).getTime());
    assert.strictEqual(D.toMs(null), null);
    assert.strictEqual(D.fmtDateTime(new Date(2025, 4, 14, 9, 5).getTime(), true), "14 мая 2025, 09:05");
    assert.strictEqual(D.fmtDateTime(new Date(2024, 9, 1, 16, 12).getTime(), true), "1 октября 2024, 16:12");
    assert.strictEqual(D.fmtDateTime(new Date(2024, 9, 1).getTime(), false), "1 октября 2024");
    assert.strictEqual(D.fromFilename("2024-03-02 заметка"), new Date(2024, 2, 2).getTime());
  });
  await test("ru.plural", () => { const { plural } = R("lib/ru"); const f = ["заметка", "заметки", "заметок"]; assert.deepStrictEqual([1, 2, 5, 11, 21, 22].map((n) => plural(n, f)), ["заметка", "заметки", "заметок", "заметок", "заметка", "заметки"]); });
  await test("text.truncateMarkdown не рвёт [[ссылки]]", () => {
    const { truncateMarkdown } = R("lib/text");
    const r = truncateMarkdown("слово ".repeat(10) + "[[Длинная ссылка на заметку]] конец", 66);
    assert.ok(r.truncated && !/\[\[[^\]]*$/.test(r.text.replace("…", "")), r.text);
  });
  await test("analyzer: медиа, цитаты, задачи, ссылки", () => {
    const f = R("model/analyzer").analyze("---\na: 1\n---\n![[a.mp3]] ![x](b.png)\n> [!quote] Автор\n> Текст цитаты\n\n- [x] one\n- [ ] two\nhttps://e.com/x");
    assert.deepStrictEqual(f.media.map((m) => m.kind), ["audio", "image"]);
    assert.strictEqual(f.quotes[0].callout.title, "Автор");
    assert.strictEqual(f.quotes[0].text, "Текст цитаты");
    assert.deepStrictEqual([f.tasks.total, f.tasks.done], [2, 1]);
    assert.strictEqual(f.external[0], "https://e.com/x");
  });
  const mk = (o) => ({ ts: Date.now(), tags: [], attrs: new Set(), backlinks: 0, search: "", source: null, type: "text", mtime: 0, size: 0, title: "t", ...o });
  await test("filters: any/all/not, вложенные теги, период, бэклинки", () => {
    const { applyFilter } = R("filters/engine"), { merge } = R("filters/state");
    const ps = [mk({ tags: ["a/b"], backlinks: 5 }), mk({ tags: ["c"] }), mk({ tags: ["a", "x"], ts: Date.now() - 40 * 864e5 })];
    assert.strictEqual(applyFilter(ps, merge({ any: ["a"] })).length, 2);
    assert.strictEqual(applyFilter(ps, merge({ any: ["a"], not: ["x"] })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ all: ["a", "x"] })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ period: "30d" })).length, 2);
    assert.strictEqual(applyFilter(ps, merge({ minBacklinks: 3 })).length, 1);
  });
  await test("state.toggleTag: тег живёт в одном режиме", () => {
    const S = R("filters/state"); let f = S.defaultFilter();
    f = S.toggleTag(f, "any", "#Foo"); f = S.toggleTag(f, "not", "foo");
    assert.deepStrictEqual([f.any, f.not], [[], ["foo"]]);
    assert.deepStrictEqual(S.toggleTag(f, "not", "foo").not, []);
  });
  await test("formula + DQL", () => {
    const S = R("filters/state"), F = R("filters/formula"), Q = R("filters/dql");
    const f = S.merge({ any: ["мысли", "daily"], not: ["архив"], period: "14d", minBacklinks: 3, attrs: ["task"] });
    assert.strictEqual(F.toString(f), "( #мысли OR #daily ) AND NOT ( !#архив ) AND С задачами".replace("С задачами", "Задачи"));
    const { query } = Q.compile(f, { config: { sources: [{ id: "lj", folder: "LiveJournal" }] } });
    for (const part of ['FROM "LiveJournal"', 'contains(file.tags, "#мысли") OR contains(file.tags, "#daily")', '!contains(file.tags, "#архив")', "dur(14 days)", "length(file.inlinks) >= 3", "length(file.tasks) > 0", "SORT file.cday DESC"]) assert.ok(query.includes(part), "нет: " + part + "\n" + query);
  });
  await test("stats: streak, heatmap, tags", () => {
    const A = R("stats/activity"), now = new Date(2026, 9, 16, 12).getTime(), day = 864e5;
    const posts = [0, 1, 2, 5].map((d) => ({ ts: now - d * day }));
    const by = A.countByDay(posts);
    assert.deepStrictEqual(A.streak(by, now), { current: 3, best: 3 });
    const hm = A.heatmap(by, now, 53);
    assert.strictEqual(hm.length, 53); assert.ok(hm.every((c) => c.length === 7));
    assert.deepStrictEqual(R("stats/tags").tagCounts([{ tags: ["a", "b"] }, { tags: ["a"] }]), [{ tag: "a", count: 2 }, { tag: "b", count: 1 }]);
  });
  await test("quick: today + random детерминирован", () => {
    const Q = R("filters/quick-modes"), now = Date.now();
    const ps = [mk({ ts: now }), mk({ ts: now - 365 * 864e5 }), mk({ ts: now - 100 * 864e5 })];
    const c = { now, seed: 7, config: { randomCount: 2 }, flags: { isFavorite: () => false } };
    assert.ok(Q.applyQuick(ps, "today", c).length >= 1);
    assert.deepStrictEqual(Q.applyQuick(ps, "random", c), Q.applyQuick(ps, "random", c));
    assert.strictEqual(Q.applyQuick(ps, "random", c).length, 2);
  });

  await test("lib/layout.columnCount: min/max и телефон", () => {
    const { columnCount } = R("lib/layout"), cfg = { columns: { min: 2, max: 4 }, minCardWidth: 320 };
    assert.deepStrictEqual([400, 700, 1000, 1400, 2400, 0].map((w) => columnCount(w, cfg)), [1, 2, 2, 4, 4, 4]);
    assert.strictEqual(columnCount(700, { columns: { min: 3, max: 5 }, minCardWidth: 320 }), 3);
    assert.strictEqual(columnCount(2400, { columns: { min: 1, max: 3 }, minCardWidth: 320 }), 3);
  });
  await test("text.snippet / plainText", () => {
    const T = R("lib/text");
    assert.strictEqual(T.plainText("## Заголовок\n- [ ] **жирный** [[Заметка|алиас]] и [ссылка](http://x)"), "Заголовок жирный алиас и ссылка");
    assert.ok(T.snippet("слово ".repeat(60), 50).endsWith("…"));
  });
  await test("stats.monthStats: считает файлы фото и видео", () => {
    const { monthStats } = R("stats/period"), now = Date.now();
    const p = (c) => ({ ts: now, links: 0, backlinks: 0, mediaCounts: c, mediaKinds: new Set() });
    const r = monthStats([p({ image: 5, video: 0, audio: 0 }), p({ image: 2, video: 3, audio: 1 })], now);
    assert.deepStrictEqual([r.media.photo, r.media.video, r.media.audio, r.mediaNotes.photo, r.mediaNotes.video], [7, 3, 1, 2, 1]);
  });
  await test("поиск: несколько слов через пробел", () => {
    const { applyFilter } = R("filters/engine"), { merge } = R("filters/state");
    const ps = [mk({ search: "заметка про crdt", tags: [] }), mk({ search: "заметка про граф" })];
    assert.strictEqual(applyFilter(ps, merge({ text: "crdt заметка" })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ text: "заметка" })).length, 2);
  });

  console.log("\nsmoke (UI на заглушке DOM)");
  const types = {};
  const mkEnv = async (input) => {
    const container = document.createElement("div");
    const dv = makeDv(container);
    await R("app/main").run({ dv, app, input, root: ROOT, container });
    await new Promise((r) => setTimeout(r, 30));
    return container;
  };
  await test("css подключается", async () => { await mkEnv({ view: "stream", id: "css" }); const st = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)); assert.ok(st && st.textContent.includes(".sf-card")); });
  for (const view of ["overview", "stream", "bento", "collections", "studio"]) {
    await test(`экран ${view} рисуется без ошибок`, async () => {
      const c = await mkEnv({ view, id: "t-" + view });
      assert.strictEqual(c.byClass("sf-error").length, 0, (c.byClass("sf-error")[0] || {}).textContent);
      assert.ok(c.byClass("sf-root").length === 1);
      if (view === "stream" || view === "bento") {
        const cards = c.byClass("sf-card");
        assert.ok(cards.length >= 9, "карточек: " + cards.length);
        for (const k of ["video", "audio", "image", "quote", "tasks", "link", "canvas"]) assert.ok(cards.some((x) => x.classList.contains("sf-card--" + k)), "нет типа " + k);
        assert.ok(c.byClass("sf-audio").length === 1 && c.byClass("sf-images__more").length === 1);
      }
      if (view === "collections") assert.strictEqual(c.byClass("sf-preset").length, 6);
      if (view === "studio") assert.ok(c.byClass("sf-dql").length === 1 && c.byClass("sf-dql")[0].textContent.includes("TABLE"));
    });
  }
  await test("интерактив: тег, быстрый режим, переключение экрана, избранное", async () => {
    const c = await mkEnv({ view: "stream", id: "inter" });
    const count = () => c.byClass("sf-card").length;
    const total = count();
    c.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click();
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(count() < total && count() >= 1, `после фильтра: ${count()} из ${total}`);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#daily"));
    c.byClass("sf-quick--random")[0].click(); await new Promise((r) => setTimeout(r, 20));
    assert.ok(c.byClass("sf-shuffle").length === 1);
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Бенто")).click(); await new Promise((r) => setTimeout(r, 30));
    assert.ok(c.byClass("sf-feed--bento").length === 1);
    c.byClass("sf-card__meta")[0].byClass("sf-iconbtn")[1].click();
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(Object.keys(readDb().flags).length === 1);
  });
  await test("fullWidth: кнопка переключает класс is-full", async () => {
    const c = await mkEnv({ view: "stream", id: "fw" });
    const root = c.byClass("sf-root")[0];
    assert.ok(!root.classList.contains("is-full"));
    c.byClass("sf-nav")[0].byClass("sf-iconbtn")[0].click(); await new Promise((r) => setTimeout(r, 20));
    assert.ok(root.classList.contains("is-full"));
    const c2 = await mkEnv({ view: "stream", id: "fw2", fullWidth: true });
    assert.ok(c2.byClass("sf-root")[0].classList.contains("is-full"));
  });
  await test("студия: сохранение подборки в едином файле данных", async () => {
    const c = await mkEnv({ view: "studio", id: "studio-save" });
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Тест" } });
    const before = readDb().presets.length;
    c.byClass("sf-btn--primary").find((x) => x.textContent.includes("Сохранить")).click();
    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(readDb().presets.length, before + 1);
  });
  await test("единый файл данных: создаётся, содержит всё; после удаления пересоздаётся", async () => {
    await mkEnv({ view: "stream", id: "db1" });
    const d = readDb();
    assert.ok(d.settings && d.settings.columns.min === 2 && d.settings.columns.max === 4 && Array.isArray(d.presets) && d.presets.length >= 6 && d.flags && d.ui);
    const files = fs.readdirSync(path.join(VAULT, ROOT, "data"));
    assert.deepStrictEqual(files, ["social_feed.json"]);
    fs.unlinkSync(path.join(VAULT, ROOT, "data/social_feed.json"));
    await mkEnv({ view: "stream", id: "db2" });
    assert.ok(readDb().presets.length === 6);
  });
  await test("masonry: колонки по config.columns, карточки распределены", async () => {
    const c = await mkEnv({ view: "stream", id: "ms" }); await wait(80);
    assert.strictEqual(c.byClass("sf-masonry__col").length, 4);
    assert.ok(c.byClass("sf-masonry__col").reduce((n, col) => n + col.byClass("sf-card").length, 0) >= 9);
  });
  await test("bento: плитки в сетке, у карточек нет masonry-колонок", async () => {
    const c = await mkEnv({ view: "bento", id: "bn" }); await wait(80);
    assert.ok(c.byClass("sf-bento__item").length >= 9 && c.byClass("sf-masonry").length === 0);
    assert.ok(c.byClass("sf-bento")[0].style.gridTemplateColumns.startsWith("repeat(4"));
  });
  await test("timeline: группы по дням; flow из старых настроек читается как timeline", async () => {
    const c = await mkEnv({ view: "stream", id: "tl", layout: "flow" }); await wait(40);
    assert.ok(c.byClass("sf-timeline__group").length >= 5 && c.byClass("sf-feed--timeline").length === 1);
    assert.deepStrictEqual(c.byClass("sf-segmented__btn").map((b) => b.textContent), ["Masonry", "Timeline"]);
  });
  await test("дата в карточке: «1 октября 2024, 16:12»", async () => {
    const c = await mkEnv({ view: "stream", id: "dt" }); await wait(40);
    assert.ok(c.byClass("sf-card__date").some((d) => /^\d{1,2} [а-я]+ \d{4}(, \d{2}:\d{2})?$/.test(d.textContent)), c.byClass("sf-card__date")[0].textContent);
  });
  await test("поиск: результаты сразу, очистка возвращает ленту", async () => {
    const c = await mkEnv({ view: "stream", id: "srch" }); await wait(60);
    const total = () => c.byClass("sf-card").length, all = total();
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.dispatch("focus"); await wait(150);
    input.dispatch("input", { target: { value: "crdt" } }); await wait(250);
    assert.ok(total() >= 1 && total() < all, `после поиска: ${total()} из ${all}`);
    c.byClass("sf-search__clear")[0].click(); await wait(250);
    assert.strictEqual(total(), all);
  });
  await test("сессия: возврат в блок сохраняет раздел и фильтры; вход через навигацию сбрасывает", async () => {
    const c1 = await mkEnv({ view: "stream", id: "sess" }); await wait(40);
    c1.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click();
    c1.byClass("sf-nav__tab").find((x) => x.textContent.includes("Бенто")).dispatch("click"); // вход в раздел → сброс
    await wait(60);
    assert.ok(!c1.byClass("sf-formula__body")[0].textContent.includes("#daily"), "после входа в раздел фильтр должен быть сброшен");
    c1.byClass("sf-chip").find((x) => x.textContent.startsWith("#мысли") && x.classList.contains("is-clickable")).click(); await wait(40);
    const c2 = await mkEnv({ view: "stream", id: "sess" }); await wait(60); // «вернулись» в заметку
    assert.ok(c2.byClass("sf-feed--bento").length === 1, "раздел восстановлен");
    assert.ok(c2.byClass("sf-formula__body")[0].textContent.includes("#мысли"), "фильтр восстановлен");
  });
  await test("конструктор: каждый вход через навигацию — новый", async () => {
    const c = await mkEnv({ view: "studio", id: "std" });
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Черновик" } });
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Обзор")).dispatch("click"); await wait(30);
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Фильтры")).dispatch("click"); await wait(40);
    const name = c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например"));
    assert.strictEqual(name.value || "", "");
    assert.ok(c.byClass("sf-hero")[0].textContent.includes("Новый смарт-фильтр"));
  });
  await test("конструктор: есть Сохранить и Удалить; удалить неактивно до сохранения; сохранить требует название", async () => {
    const c = await mkEnv({ view: "studio", id: "std2" });
    const bar = c.byClass("sf-actionbar")[0];
    assert.ok(bar.textContent.includes("Сохранить подборку") && bar.textContent.includes("Удалить"));
    const del = bar.byClass("sf-btn--danger")[0]; assert.ok(del.attrs.disabled !== undefined);
    const before = readDb().presets.length;
    bar.byClass("sf-btn--primary")[0].click(); await wait(500);
    assert.strictEqual(readDb().presets.length, before, "без названия не сохраняется");
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Моя" } });
    bar.byClass("sf-btn--primary")[0].click(); await wait(600);
    assert.strictEqual(readDb().presets.length, before + 1);
    const bar2 = c.byClass("sf-actionbar")[0];
    assert.ok(bar2.textContent.includes("Сохранить как новую") && bar2.byClass("sf-btn--danger")[0].attrs.disabled === undefined);
    const del2 = bar2.byClass("sf-btn--danger")[0]; del2.click(); del2.click(); await wait(600); // двойной клик = подтверждение
    assert.strictEqual(readDb().presets.length, before);
  });
  await test("подборки: клик по карточке открывает Бенто; удаление с подтверждением; текст в превью", async () => {
    const c = await mkEnv({ view: "collections", id: "col" }); await wait(80);
    assert.ok(c.byClass("sf-richlink__excerpt").some((e) => e.textContent.length > 10), "в превью есть текст заметки");
    const n = c.byClass("sf-preset").length, del = c.byClass("sf-preset")[0].byClass("sf-iconbtn").find((b) => b.attrs.title === "Удалить подборку");
    del.click(); del.click(); await wait(600);
    assert.strictEqual(c.byClass("sf-preset").length, n - 1);
    c.byClass("sf-preset")[0].dispatch("click"); await wait(80);
    assert.ok(c.byClass("sf-feed--bento").length === 1, "открылся Бенто");
  });
  await test("меню подборок: применить, сохранить текущий фильтр, удалить", async () => {
    const c = await mkEnv({ view: "stream", id: "menu" }); await wait(60);
    const dd = c.byClass("sf-dropdown")[0];
    dd.byClass("sf-btn")[0].click();
    assert.ok(dd.byClass("sf-menu__item").length >= 3);
    dd.byClass("sf-menu__item").find((b) => b.textContent.includes("Цитаты")).click(); await wait(60);
    assert.ok(c.byClass("sf-feed").length === 1 && c.byClass("sf-formula__body")[0].textContent.includes("quote") === false);
    c.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click(); await wait(40);
    dd.byClass("sf-btn")[0].click(); dd.byClass("sf-btn")[0].click();
    const before = readDb().presets.length;
    const input = dd.byClass("sf-menu__save")[0].byClass("sf-input")[0];
    input.value = "Из меню";
    dd.byClass("sf-menu__save")[0].byClass("sf-btn--primary")[0].click(); await wait(600);
    assert.strictEqual(readDb().presets.length, before + 1);
    assert.ok(readDb().presets.some((p) => p.name === "Из меню" && p.filter.any.includes("daily")));
  });
  await test("пульс: карточки «Добавлено фото» и «Добавлено видео»", async () => {
    const c = await mkEnv({ view: "overview", id: "pls" });
    const t = c.byClass("sf-stat__head").map((x) => x.textContent).join("|");
    assert.ok(t.includes("Добавлено фото") && t.includes("Добавлено видео"), t);
  });
  await test("css: hover карточки, размер цитаты, без column-count", async () => {
    await mkEnv({ view: "stream", id: "css2" });
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(css.includes("--sf-quote-size: calc(17px / 1.5)") && css.includes(".sf-card:hover { background: var(--sf-surface-hover)") && !css.includes("column-count"));
  });

  await test("открытие заметки по клику на заголовок", async () => {
    const c = await mkEnv({ view: "stream", id: "open" });
    const t = c.byClass("sf-card__title")[0]; t.dispatch("click", { ctrlKey: true });
    assert.ok(app.opened.length === 1 && app.opened[0][1] === true);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  fs.rmSync(VAULT, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
