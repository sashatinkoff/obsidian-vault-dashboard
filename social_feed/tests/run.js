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
    assert.strictEqual(F.toString(f), "( #мысли OR #daily ) AND NOT ( !#архив ) AND Задачи AND период: за 14 дней AND связи ≥ 3");
    assert.ok(F.toTokens(S.merge({ types: ["audio"], sources: ["lj"], text: "x", day: "2026-01-01" })).filter((t) => t.t === "cond").length === 4, "скрытых условий нет — все видны как чипы");
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
  const mkEnv = async (input0, width) => {
    const input = { viewMode: "auto", ...input0 };
    const container = document.createElement("div");
    container.__attached = true;
    if (width) container.clientWidth = width;
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
    assert.ok(root.classList.contains("is-full"), "по умолчанию — на всю ширину");
    c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("ширину") || b.attrs.title.includes("Обычная")).click(); await new Promise((r) => setTimeout(r, 20));
    assert.ok(!root.classList.contains("is-full"));
    const c2 = await mkEnv({ view: "stream", id: "fw2", fullWidth: false });
    assert.ok(!c2.byClass("sf-root")[0].classList.contains("is-full"));
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
    assert.strictEqual(c.byClass("sf-tilegrid--masonry").length, 1);
    assert.ok(c.byClass("sf-tilegrid__item").length >= 9 && c.byClass("sf-tilegrid__item").every((i) => i.children[0].classList.contains("sf-card")));
  });
  await test("bento: плитки в сетке, у карточек нет masonry-колонок", async () => {
    const c = await mkEnv({ view: "bento", id: "bn" }); await wait(80);
    assert.strictEqual(c.byClass("sf-tilegrid--bento").length, 1);
    assert.ok(c.byClass("sf-tilegrid__item").length >= 9);
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
    assert.ok(c.byClass("sf-feed").length === 1 && c.byClass("sf-formula__body")[0].textContent.includes("подборка: Цитаты") && c.byClass("sf-formula__body")[0].textContent.split("Цитаты").length >= 3, "условие подборки (атрибут «Цитаты») видно в формуле");
    c.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click(); await wait(40);
    dd.byClass("sf-btn")[0].click(); dd.byClass("sf-btn")[0].click();
    const before = readDb().presets.length;
    const input = dd.byClass("sf-menu__save")[0].byClass("sf-input")[0];
    input.value = "Из меню";
    dd.byClass("sf-menu__save")[0].byClass("sf-btn--primary")[0].click(); await wait(600);
    assert.strictEqual(readDb().presets.length, before + 1);
    assert.ok(readDb().presets.some((p) => p.name === "Из меню" && p.filter.any.includes("daily")));
  });
  await test("пульс месяца: 4 карточки с графиком, стрик из 7 кружков, медиа с фото и видео, теги", async () => {
    const c = await mkEnv({ view: "overview", id: "pls" }); await wait(40);
    const labels = c.byClass("sf-pcard__label").map((x) => x.textContent);
    assert.deepStrictEqual(labels, ["Создано заметок", "Стрик регулярности", "Семантические связи", "Медиа за месяц"]);
    assert.ok(c.byClass("sf-spark").length === 1 && c.byClass("sf-spark__dot").length === 1, "график накопления");
    assert.strictEqual(c.byClass("sf-streak__day").length, 7);
    const leg = c.byClass("sf-legend__item").map((x) => x.textContent).join("|");
    assert.ok(leg.includes("фото") && leg.includes("видео") && leg.includes("аудио"), leg);
    assert.ok(c.byClass("sf-tagstrip").length === 1);
  });
  await test("css: hover карточки, размер цитаты, без column-count", async () => {
    await mkEnv({ view: "stream", id: "css2" });
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(css.includes("--sf-quote-size: calc(17px / 1.5)") && css.includes(".sf-card:hover { background: linear-gradient(") && !css.includes("column-count"));
  });

  await test("tile-grid: порядок слева направо, затем сверху вниз; широкие плитки на 2 колонки", async () => {
    const tileGrid = R("ui/feed/tile-grid");
    const cfg = { columns: { min: 2, max: 4 }, minCardWidth: 320 };
    const mkCard = (cls, hgt) => { const c = document.createElement("div"); c.className = cls; c.sfReady = Promise.resolve(); c._h = hgt; return c; };
    const cards = [mkCard("a", 100), mkCard("b", 300), mkCard("c", 100), mkCard("d", 100), mkCard("e", 100), mkCard("f", 100), mkCard("wide", 100)];
    const el = tileGrid({ config: cfg }, cards, { wide: (c) => c.classList.contains("wide") });
    el.clientWidth = 1500;
    el.childNodes.forEach((it) => Object.defineProperty(it, "offsetHeight", { get() { return it.firstChild._h; } }));
    await wait(40);
    const pos = (i) => ({ left: parseFloat(el.childNodes[i].style.left), top: parseFloat(el.childNodes[i].style.top), w: parseFloat(el.childNodes[i].style.width) });
    // первая строка: a b c d слева направо
    assert.ok(pos(0).left < pos(1).left && pos(1).left < pos(2).left && pos(2).left < pos(3).left && [0, 1, 2, 3].every((i) => pos(i).top === 0), "первая строка слева направо");
    // e — под самой короткой колонкой слева (a, c, d равны по высоте → самая левая из коротких = колонка a)
    assert.ok(pos(4).left === pos(0).left && pos(4).top > 0, "e под a");
    // f — следующая короткая слева направо (c)
    assert.ok(pos(5).left === pos(2).left, "f под c");
    assert.ok(pos(6).w > pos(0).w * 1.9, "широкая плитка занимает две колонки");
    el.sfDispose();
  });
  await test("карточка: клик открывает заметку; клик по чипу тега — фильтр, а не открытие", async () => {
    const c = await mkEnv({ view: "stream", id: "clk" }); await wait(60);
    app.opened.length = 0;
    const card = c.byClass("sf-card")[0];
    card.dispatch("click");
    assert.strictEqual(app.opened.length, 1, "открыта заметка");
    const chipEl = card.byClass("sf-chip")[0];
    chipEl.dispatch("click", { target: chipEl }); // обработчик чипа; всплытие до карточки в заглушке не эмулируется — проверяем guard напрямую
    assert.strictEqual(app.opened.length, 1);
    card.dispatch("click", { target: chipEl });
    assert.strictEqual(app.opened.length, 1, "клик по чипу не открывает заметку");
  });
  await test("тег внутри текста карточки применяется на странице (а не уходит в поиск Obsidian)", async () => {
    const c = await mkEnv({ view: "stream", id: "taglink" }); await wait(80);
    const box = c.byClass("sf-card__text")[0];
    const a = document.createElement("a"); a.className = "tag"; a.setAttribute("href", "#zettel"); a.append("#zettel"); box.append(a);
    let prevented = false;
    box.dispatch("click", { target: a, preventDefault() { prevented = true; } });
    await wait(40);
    assert.ok(prevented, "стандартное поведение Obsidian отменено");
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#zettel"), "тег появился в формуле фильтра");
  });
  await test("автодополнение тега: подсказки, выбор, submit формы (мобильный Enter/«+»)", async () => {
    const { suggestTags } = R("ui/filters/tag-builder");
    assert.deepStrictEqual(suggestTags([{ tag: "daily", count: 3 }, { tag: "mydaily", count: 9 }, { tag: "dev", count: 1 }], "da").map((t) => t.tag), ["daily", "mydaily"]);
    const c = await mkEnv({ view: "studio", id: "ac" });
    const input = c.byClass("sf-tagadd__input")[0];
    input.value = "da"; input.dispatch("input");
    const items = c.byClass("sf-suggest__item");
    assert.ok(items.length >= 1 && items[0].textContent.includes("#daily"), "подсказка #daily");
    items[0].dispatch("click"); await wait(30);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#daily"));
    input.value = "новыйтег"; c.byClass("sf-tagadd")[0].dispatch("submit"); await wait(30);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#новыйтег"), "submit формы добавляет тег");
  });
  await test("кнопка «Наверх»: fixed в <body>, появляется после прокрутки, возвращает наверх, не плодится", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sc = document.createElement("div"); sc.className = "markdown-preview-view"; sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 6000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const mount = async () => { const container = document.createElement("div"); sc.append(container); await R("app/main").run({ dv: makeDv(container), app, input: { view: "stream", id: "fab", viewMode: "auto" }, root: ROOT, container }); return container; };
    await mount(); await wait(60);
    const fabs = () => document.body.children.filter((n) => n.classList.contains("sf-fab") && n.isConnected);
    const first = fabs().at(-1);
    assert.ok(first && first.classList.contains("is-hidden"), "наверху кнопка скрыта");
    assert.strictEqual(first.parentNode, document.body, "кнопка в <body> (fixed), а не sticky внутри виджета");
    sc.scrollTop = 900; await wait(30);
    assert.ok(!first.classList.contains("is-hidden"), "после прокрутки вниз кнопка видна");
    first.byClass("sf-fab__btn")[0].click(); await wait(30);
    assert.strictEqual(sc.scrollTop, 0, "клик возвращает наверх");
    assert.ok(first.classList.contains("is-hidden"), "наверху снова скрыта");
    sc.scrollTop = 900;
    sc.children.forEach((ch) => sc.removeChild(ch));
    await mount(); await wait(60);
    assert.strictEqual(first.parentNode, null, "при перерисовке блока старая кнопка убрана");
    assert.strictEqual(fabs().filter((n) => n !== first).length >= 1, true);
  });
  await test("картинки: centerCrop и никаких hover-эффектов; токены темы доступны кнопке в <body>", async () => {
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(/\.sf-images \{[^}]*aspect-ratio: 16 \/ 10/.test(css), "рамка фиксированных пропорций");
    assert.ok(/\.sf-images__cell img \{[^}]*position: absolute; inset: 0;[^}]*object-fit: cover; object-position: 50% 50%/.test(css), "centerCrop");
    assert.ok(!/\.sf-images__cell:hover img/.test(css) && !css.includes("brightness(1.08); } /* без масштабирования"), "hover-эффект на картинке убран");
    assert.ok(/\.sf-card img \{[^}]*transform: none !important[^}]*filter: none !important/.test(css));
    assert.ok(css.includes('.sf-fab[data-sf-theme="dark"]'));
  });
  await test("дата и время как в заметке: «1 октября 2024, 16:12»", async () => {
    const D = R("lib/date");
    assert.strictEqual(D.toMs("1 октября 2024, 16:12"), new Date(2024, 9, 1, 16, 12).getTime());
    assert.strictEqual(D.toMs("1 окт 2024 г. в 07:05"), new Date(2024, 9, 1, 7, 5).getTime());
    assert.strictEqual(D.toMs("21 мая 2025"), new Date(2025, 4, 21).getTime());
    const c = await mkEnv({ view: "stream", id: "ru", filter: { text: "ru-date" } }); await wait(60);
    assert.ok(c.byClass("sf-card__date").some((d) => d.textContent === "1 октября 2024, 16:12"), c.byClass("sf-card__date").map((d) => d.textContent).join("|"));
  });
  await test("открытие в новой вкладке: настройка в навигации и Ctrl-клик", async () => {
    const c = await mkEnv({ view: "stream", id: "nt" }); await wait(60);
    app.opened.length = 0;
    c.byClass("sf-card__title")[0].dispatch("click");
    assert.strictEqual(app.opened[0][1], false);
    c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("вкладк")).click(); await wait(20);
    c.byClass("sf-card__title")[0].dispatch("click");
    assert.strictEqual(app.opened[1][1], true, "в новой вкладке после включения");
  });
  await test("«В этот день»: счётчик подборки совпадает с лентой, пустое состояние объясняет условия", async () => {
    const c = await mkEnv({ view: "collections", id: "today-cnt" }); await wait(80);
    const card = c.byClass("sf-preset").find((x) => x.textContent.includes("В этот день"));
    const n = card.byClass("sf-preset__count")[0].textContent.split(" ")[0];
    card.dispatch("click"); await wait(100);
    assert.strictEqual(c.byClass("sf-counter__n")[0].textContent.split(" ")[0], n);
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.value = "ничегонет"; input.dispatch("input"); await wait(250);
    const hint = c.byClass("sf-empty__hint")[0].textContent;
    assert.ok(hint.includes("режим «В этот день»") && hint.includes("поиск: «ничегонет»"), hint);
  });
  await test("версия: бейдж на странице со ссылкой на README; запись в README; appVersion в файле; уведомление после обновления", async () => {
    const { VERSION } = R("app/version");
    const readme = fs.readFileSync(path.join(SRC, "README.md"), "utf8");
    assert.ok(readme.includes("## История версий") && readme.includes(`### v${VERSION} `), "в README нет записи для v" + VERSION);
    assert.ok(readme.split("\n")[2].includes(VERSION), "строка версии под заголовком README устарела");
    const c = await mkEnv({ view: "stream", id: "ver" }); await wait(40);
    const badge = c.byClass("sf-version")[0];
    assert.strictEqual(badge.textContent, "v" + VERSION);
    app.opened.length = 0; badge.dispatch("click");
    assert.ok(app.opened[0][0].endsWith("README#История версий"), app.opened[0][0]);
    await wait(500);
    assert.strictEqual(readDb().appVersion, VERSION);
    // файл записан «старой» версией → после запуска показывается уведомление
    const d = readDb(); d.appVersion = "0.5.0"; fs.writeFileSync(path.join(VAULT, ROOT, "data/social_feed.json"), JSON.stringify(d));
    const c2 = await mkEnv({ view: "stream", id: "ver2" }); await wait(40);
    assert.ok(c2.byClass("sf-toast").some((t) => t.textContent.includes("v0.5.0 → v" + VERSION)), "нет уведомления об обновлении");
    // без навигации версия показана внизу страницы
    const c3 = await mkEnv({ view: "stream", id: "ver3", nav: false }); await wait(40);
    assert.ok(c3.byClass("sf-footer")[0].byClass("sf-version").length === 1);
  });
  await test("мобильная версия: классы по ширине блока, фильтры свёрнуты, подписи компактны", async () => {
    const m = await mkEnv({ view: "stream", id: "mob1" }, 390); await wait(60);
    const root = m.byClass("sf-root")[0];
    assert.ok(root.classList.contains("is-mobile") && root.classList.contains("is-compact"), "is-mobile и is-compact");
    assert.ok(m.byClass("sf-panel")[0].classList.contains("is-collapsed"), "панель фильтров на телефоне свёрнута");
    const toggle = m.byClass("sf-panel__toggle")[0];
    assert.ok(toggle.textContent.includes("Фильтры"), toggle.textContent);
    toggle.click(); await wait(20);
    assert.ok(!m.byClass("sf-panel")[0].classList.contains("is-collapsed"), "кнопка «Фильтры» раскрывает панель");
    // «В этот день» — без даты
    const today = m.byClass("sf-quick--today")[0];
    assert.ok(today.textContent.startsWith("В этот день") && !/\d{1,2} [а-я]+/.test(today.textContent.replace(/\d+$/, "")) && m.byClass("sf-quick__sub").length === 0, today.textContent);
    const d = await mkEnv({ view: "stream", id: "mob2" }, 1400); await wait(60);
    assert.ok(!d.byClass("sf-root")[0].classList.contains("is-mobile") && !d.byClass("sf-panel")[0].classList.contains("is-collapsed"), "на десктопе панель развёрнута");
    const t = await mkEnv({ view: "stream", id: "mob3" }, 700); await wait(30);
    assert.ok(t.byClass("sf-root")[0].classList.contains("is-compact") && !t.byClass("sf-root")[0].classList.contains("is-mobile"));
  });
  await test("мобильная версия: все экраны рисуются без ошибок", async () => {
    for (const view of ["overview", "stream", "bento", "collections", "studio"]) {
      const c = await mkEnv({ view, id: "mobv-" + view }, 390); await wait(40);
      assert.strictEqual(c.byClass("sf-error").length, 0, view + ": " + (c.byClass("sf-error")[0] || {}).textContent);
      assert.ok(c.byClass("sf-root")[0].classList.contains("is-mobile"));
    }
  });
  await test("мобильная версия: css содержит мобильные правила; columnCount даёт 1 колонку; страница меньше", async () => {
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(css.includes(".sf-root.is-mobile .sf-nav__tabs") && css.includes(".sf-root.is-mobile .sf-timeline__group") && css.includes("font-size: 16px"));
    assert.strictEqual(R("lib/layout").columnCount(390, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 560 }), 1);
    assert.strictEqual(readDb().settings.pageSizeMobile, 12);
  });
  await test("прокрутка: возврат восстанавливает позицию; «зажатые» значения и мёртвый виджет её не затирают", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sess = () => window.__sfSession["::scr"];
    const sc = document.createElement("div"); sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 5000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const mount = async () => { const container = document.createElement("div"); sc.append(container); await R("app/main").run({ dv: makeDv(container), app, input: { view: "stream", id: "scr" }, root: ROOT, container }); return container; };

    const c1 = await mount(); await wait(40);
    sc.scrollTop = 1500; await wait(160);
    assert.strictEqual(sess().scroll, 1500, "позиция пользователя сохранена");

    sc.removeChild(c1);                           // Obsidian заменяет заметку: виджет мёртв…
    sc.scrollHeight = 900; sc.scrollTop = 0;      // …страница короткая, scrollTop «зажат» в 0
    await wait(160);
    assert.strictEqual(sess().scroll, 1500, "зажатое значение не затёрло позицию");

    const c2 = await mount();                     // возврат: страница ещё короткая, позиция недоступна
    await wait(200);
    assert.strictEqual(sess().scroll, 1500, "во время восстановления сохранение приостановлено");
    sc.scrollHeight = 5000;                       // карточки дорисовались — страница выросла
    await wait(400);
    assert.strictEqual(sc.scrollTop, 1500, "позиция восстановлена");
    assert.strictEqual(sess().scroll, 1500);

    document.dispatch("wheel");                   // пользователь начал прокручивать сам → восстановление прекращено
    await wait(250);
    sc.scrollTop = 700; await wait(200);
    assert.strictEqual(sess().scroll, 700, "после восстановления позиция снова сохраняется");
  });
  await test("обзор: без плиток «Пространства»; годовая карта с подписями и легендой; распределение по типам", async () => {
    const c = await mkEnv({ view: "overview", id: "ov2" }); await wait(40);
    assert.strictEqual(c.byClass("sf-tile").length, 0);
    assert.ok(!c.textContent.includes("Пространства"));
    assert.ok(c.byClass("sf-block__sub").some((x) => x.textContent.includes("Каждый квадрат — один день")), "пояснение к квадратикам");
    assert.strictEqual(c.byClass("sf-heat__legend")[0].byClass("sf-heat__cell").length, 5);
    assert.ok(c.byClass("sf-heat__month").length >= 10 && c.byClass("sf-heat__days")[0].textContent.includes("Пн"), "подписи месяцев и дней недели");
    assert.ok(c.byClass("sf-donut").length === 1 && c.byClass("sf-dist__row").length >= 2);
    const { levelRanges } = R("stats/activity");
    assert.deepStrictEqual(levelRanges(8), [[0, 0], [1, 2], [3, 4], [5, 6], [7, null]]);
  });
  await test("озарения: число карточек выбирается (3/6/9/12) и запоминается", async () => {
    const c = await mkEnv({ view: "overview", id: "ov3" }); await wait(60);
    const items = () => c.byClass("sf-insights")[0].byClass("sf-tilegrid__item").length;
    assert.strictEqual(items(), 3);
    const btns = c.byClass("sf-insights__count")[0].byClass("sf-segmented__btn");
    assert.deepStrictEqual(btns.map((b) => b.textContent), ["3", "6", "9", "12"]);
    btns[1].click(); await wait(60);
    assert.strictEqual(items(), 6);
    await wait(500);
    assert.strictEqual(readDb().ui.insightsCount, 6);
  });
  await test("карточка без «Читать далее»", async () => {
    const c = await mkEnv({ view: "stream", id: "nomore", filter: { text: "утренние" } }); await wait(80);
    assert.ok(c.byClass("sf-card__more").length === 0 && !c.textContent.includes("Читать далее"));
  });
  await test("навигация: нет бренда, вкладки на всю ширину шапки, 5 разделов", async () => {
    const c = await mkEnv({ view: "stream", id: "nav2" }, 390); await wait(40);
    const nav = c.byClass("sf-nav")[0];
    assert.ok(!nav.textContent.includes("Journal Stream") && nav.byClass("sf-nav__brand").length === 0, "бренд-чип убран");
    assert.strictEqual(nav.byClass("sf-nav__tab").length, 5);
    assert.ok(nav.byClass("sf-nav__tab").some((t) => t.byClass("sf-nav__short").length === 1 && t.byClass("sf-nav__short")[0].textContent === "Фильтры"), "короткая подпись для узких экранов");
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(/\.sf-nav__tabs \{[^}]*flex: 1 1 380px/.test(css) && /\.sf-nav__tab \{[^}]*flex: 1 0 auto/.test(css), "вкладки растягиваются на всю ширину");
    assert.ok(/\.sf-root\.is-mobile \.sf-nav__tabs \{ flex: 1 0 100%/.test(css), "на телефоне вкладки — отдельной строкой");
  });
  await test("шиммеры: tile-grid показывает заглушку до первой раскладки; стартовая заглушка убирается", async () => {
    const tileGrid = R("ui/feed/tile-grid");
    const mkCard = () => { const c = document.createElement("div"); c.sfReady = Promise.resolve(); return c; };
    const el = tileGrid({ config: { columns: { min: 2, max: 4 }, minCardWidth: 320 }, rootEl: null }, [mkCard(), mkCard()], {});
    assert.ok(el.classList.contains("is-pending") && el.byClass("sf-skelgrid").length === 1, "до раскладки видны шиммеры");
    el.clientWidth = 1200; await wait(60);
    assert.ok(!el.classList.contains("is-pending") && el.byClass("sf-skelgrid").length === 0, "после раскладки шиммеры убраны");
    el.sfDispose();
    const container = document.createElement("div"); container.__attached = true;
    const boot = document.createElement("div"); boot.className = "sf-boot"; container.append(boot);
    await R("app/main").run({ dv: makeDv(container), app, input: { view: "stream", id: "boot" }, root: ROOT, container, boot });
    await wait(30);
    assert.strictEqual(container.byClass("sf-boot").length, 0, "стартовая заглушка удалена");
  });
  await test("поиск: находит по тексту заметки (после индексации), ё=е, устойчив к нечитаемой заметке", async () => {
    const { norm } = R("lib/search");
    assert.strictEqual(norm("ЁЛКА Ёж"), "елка еж");
    const orig = app.vault.cachedRead;
    app.vault.cachedRead = async (f) => { if (f.path.endsWith("link.md")) throw new Error("boom"); return orig(f); };
    const c = await mkEnv({ view: "stream", id: "srch2" }); await wait(100);
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.dispatch("focus"); await wait(300);     // индексация (одна заметка нечитаема — остальные индексируются)
    input.value = "атомарн"; input.dispatch("input"); await wait(250);
    const n = c.byClass("sf-card").length;
    app.vault.cachedRead = orig;
    assert.ok(n >= 1, "найдена заметка, где слово есть только в тексте: " + n);
    assert.ok(c.byClass("sf-search__status")[0].textContent === "", "индексация завершена");
  });
  await test("конструктор: строка поиска по названию или тексту есть в панели фильтров", async () => {
    const c = await mkEnv({ view: "studio", id: "std3" });
    const s = c.byClass("sf-panel__search")[0];
    assert.ok(s && s.byClass("sf-input")[0].attrs.placeholder.includes("названию или тексту"));
  });
  await test("прокрутка: промежуточная обёртка с overflow:auto не сбивает позицию (клик по карточке не сохраняет 0)", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sess = () => window.__sfSession["::scr2"];
    // настоящий скроллер Obsidian (.markdown-preview-view) → «ложная» обёртка (overflow:auto, но не прокручивается) → виджет
    const sc = document.createElement("div"); sc.className = "markdown-preview-view"; sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 5000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const wrap = document.createElement("div"); wrap.__oy = "auto"; wrap.scrollHeight = 0; wrap.clientHeight = 0; wrap.scrollTop = 0; sc.append(wrap);
    const mount = async () => { const container = document.createElement("div"); wrap.append(container); await R("app/main").run({ dv: makeDv(container), app, input: { view: "stream", id: "scr2" }, root: ROOT, container }); return container; };

    const c1 = await mount(); await wait(60);
    sc.scrollTop = 1500; await wait(160);
    assert.strictEqual(sess().scroll, 1500);
    c1.byClass("sf-card__title")[0].dispatch("click");     // клик по карточке → leave()
    assert.strictEqual(sess().scroll, 1500, "позиция не затёрта нулём обёртки");
    assert.strictEqual(sess().scrollerSel, "markdown-preview-view", "запомнен настоящий контейнер прокрутки");

    wrap.removeChild(c1); sc.scrollHeight = 900; sc.scrollTop = 0; await wait(160);   // Obsidian сменил заметку
    const c2 = await mount(); await wait(150);                                       // возврат: страница ещё короткая
    sc.scrollHeight = 5000; await wait(450);                                         // карточки дорисовались
    assert.strictEqual(sc.scrollTop, 1500, "позиция восстановлена на настоящем контейнере, а не на обёртке");
    assert.strictEqual(wrap.scrollTop, 0);
  });
  await test("вид: кнопки «мобильный» / «десктопный» включают и выключают принудительный вид", async () => {
    const c = await mkEnv({ view: "stream", id: "vm1" }, 1400); await wait(50);
    const root = c.byClass("sf-root")[0];
    const btn = (title) => c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes(title));
    assert.ok(!root.classList.contains("is-mobile"));
    btn("мобильный вид").click(); await wait(80);
    assert.ok(root.classList.contains("is-mobile") && root.classList.contains("is-forced-mobile") && root.classList.contains("is-compact"), "мобильный вид включён на широком экране");
    assert.ok(c.byClass("sf-panel")[0].classList.contains("is-collapsed"), "фильтры свёрнуты, как на телефоне");
    btn("Мобильный вид включён").click(); await wait(80);
    assert.ok(!root.classList.contains("is-mobile") && !root.classList.contains("is-forced-mobile"), "повторный клик — авто");
    await wait(300);
    assert.strictEqual(readDb().ui.viewMode, "auto");

    const m = await mkEnv({ view: "stream", id: "vm2" }, 390); await wait(50);
    const mroot = m.byClass("sf-root")[0];
    assert.ok(mroot.classList.contains("is-mobile"));
    m.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("десктопный вид")).click(); await wait(80);
    assert.ok(!mroot.classList.contains("is-mobile") && mroot.classList.contains("is-forced-desktop"), "десктопный вид на узком экране");
    const L = R("lib/layout");
    assert.strictEqual(L.columnCount(390, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 0 }), 2, "в десктопном виде колонок не меньше 2");
    assert.strictEqual(L.columnCount(1600, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 100000 }), 1, "в мобильном виде — один столбец");
  });
  await test("верхние кнопки: скруглённые, в цвет акцента, градиент; кнопки вида и ширины доступны и на телефоне", async () => {
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(/--sf-accent-grad: linear-gradient/.test(css) && /--sf-accent-soft: linear-gradient/.test(css));
    assert.ok(/\.sf-nav__tab\.is-active \{ background: var\(--sf-accent-grad\)/.test(css), "активная вкладка — градиент акцента");
    assert.ok(/\.sf-nav__tab \{[^}]*border-radius: var\(--sf-r-pill\)[^}]*var\(--sf-accent-soft\)/.test(css), "неактивные — скруглённые с мягким градиентом");
    assert.ok(/\.sf-btn--primary \{ background: var\(--sf-accent-grad\)/.test(css));
    assert.ok(!css.includes(".sf-nav__fullbtn { display: none"), "кнопка ширины не скрыта на телефоне");
    const m = await mkEnv({ view: "stream", id: "btn390" }, 390); await wait(40);
    assert.strictEqual(m.byClass("sf-nav__right")[0].byClass("sf-iconbtn").length, 4, "на телефоне все 4 кнопки-иконки на месте (вид ×2, вкладка, ширина)");
  });
  await test("фильтр дат: «от» и «до» независимы (предикат, формула, DQL, подборки)", () => {
    const { applyFilter } = R("filters/engine"), S = R("filters/state"), Q = R("filters/dql"), F = R("filters/formula"), P = R("filters/presets");
    const at = (y, m, d, hh = 12) => new Date(y, m - 1, d, hh).getTime();
    const ps = [mk({ ts: at(2024, 3, 2) }), mk({ ts: at(2024, 10, 1, 16) }), mk({ ts: at(2024, 12, 31, 23) }), mk({ ts: at(2025, 5, 5) })];
    const n = (f) => applyFilter(ps, S.merge(f)).length;
    assert.deepStrictEqual([n({}), n({ dateFrom: "2024-10-01" }), n({ dateTo: "2024-10-01" }), n({ dateFrom: "2024-10-01", dateTo: "2024-12-31" }), n({ dateTo: "2024-12-31" })], [4, 3, 2, 2, 3], "границы включительно, каждая работает сама по себе");
    assert.ok(!S.isDefault({ dateFrom: "2024-01-01" }));
    const toks = F.toTokens(S.merge({ dateFrom: "2024-01-01", dateTo: "2024-12-31" })).filter((t) => t.t === "cond").map((t) => t.v);
    assert.deepStrictEqual(toks, ["с 2024-01-01", "по 2024-12-31"]);
    const q = Q.compile(S.merge({ dateFrom: "2024-06-01", dateTo: "2024-06-30" }), { config: { sources: [] } }).query;
    assert.ok(q.includes('file.cday >= date("2024-06-01")') && q.includes('file.cday < date("2024-07-01")'), q);
    assert.deepStrictEqual(P.ruleChips({ filter: { dateFrom: "2024-06-01" } }), ["с 2024-06-01"]);
  });
  await test("фильтр дат в поиске: любое из трёх полей сразу применяет фильтр", async () => {
    const c = await mkEnv({ view: "stream", id: "dates" }); await wait(80);
    const cards = () => c.byClass("sf-card").length;
    const [from, to] = c.byClass("sf-search")[0].byClass("sf-date__input");
    assert.ok(from && to && c.byClass("sf-search")[0].byClass("sf-input")[0].attrs.type === "search");
    assert.strictEqual(cards(), 11);
    to.value = "2024-12-31"; to.dispatch("change"); await wait(80);
    assert.strictEqual(cards(), 2, "только «до»");
    from.value = "2024-06-01"; from.dispatch("input"); await wait(80);
    assert.strictEqual(cards(), 1, "«от» + «до»");
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("с 2024-06-01") && c.byClass("sf-formula__body")[0].textContent.includes("по 2024-12-31"));
    to.value = ""; to.dispatch("change"); await wait(80);
    assert.strictEqual(cards(), 10, "только «от»");
    const text = c.byClass("sf-search")[0].byClass("sf-input")[0];
    text.value = "стрим"; text.dispatch("input"); await wait(250);   // текст + «от» вместе
    assert.ok(cards() <= 1, "текст работает вместе с датой: " + cards());
    text.value = ""; text.dispatch("input"); from.value = ""; from.dispatch("change"); await wait(250);
    assert.strictEqual(cards(), 11, "всё очищено");
  });
  await test("теги: «подкладки» Топ · Случайные · За год · Этот день", async () => {
    const c = await mkEnv({ view: "stream", id: "tt" }, 1400); await wait(60);
    const tabs = () => c.byClass("sf-tagtab");
    assert.deepStrictEqual(tabs().map((t) => t.textContent), ["Топ", "Случайные", "За год", "Этот день"]);
    assert.ok(tabs()[0].classList.contains("is-active"));
    const chips = () => c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip").map((x) => x.textContent);
    assert.ok(chips().some((t) => t.startsWith("#daily")), "топ: самые частые теги");
    tabs()[3].click(); await wait(20);
    const today = chips();
    assert.ok(today.some((t) => t.startsWith("#мысли")) && !today.some((t) => t.startsWith("#daily")), "этот день: теги заметок прошлых лет в эту дату — " + today.join(","));
    tabs()[2].click(); await wait(20);
    assert.ok(chips().some((t) => t.startsWith("#daily")), "за год");
    tabs()[1].click(); await wait(20);
    assert.ok(tabs()[1].classList.contains("is-active") && chips().length >= 3, "случайные");
    chips(); c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip")[0].dispatch("click"); await wait(40);
    tabs()[0].click(); await wait(20);
    assert.ok(c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip")[0].classList.contains("is-active"), "выбранный тег остаётся первым при смене набора");
  });
  await test("сортировка по времени: «Новые» по умолчанию, переключатель «Старые»", async () => {
    const c = await mkEnv({ view: "stream", id: "srt" }, 1400); await wait(80);
    const btn = c.byClass("sf-sortbtn")[0];
    assert.strictEqual(btn.textContent, "Новые");
    const first = () => c.byClass("sf-card__date")[0].textContent;
    const newest = first();
    btn.click(); await wait(80);
    assert.strictEqual(btn.textContent, "Старые");
    assert.strictEqual(first(), "2 марта 2024", "сначала самые старые: " + first());
    btn.click(); await wait(80);
    assert.strictEqual(btn.textContent, "Новые");
    assert.strictEqual(first(), newest);
  });
  await test("фильтры: только атрибуты (ряд «Тип» убран); «FORMULA» убрано; переключатели панели — иконки", async () => {
    const c = await mkEnv({ view: "stream", id: "fl2" }, 1400); await wait(60);
    assert.deepStrictEqual(c.byClass("sf-attrs__label").map((x) => x.textContent), ["Атрибуты:"]);
    assert.ok(!c.textContent.includes("FORMULA") && c.byClass("sf-formula__label").length === 0);
    assert.strictEqual(c.byClass("sf-panel__toggle")[0].textContent, "", "переключатель панели — только иконка");
    assert.ok(!c.textContent.includes("Свернуть в 1 строку") && !c.textContent.includes("Развернуть панель") && !c.textContent.includes("Условия"));
    assert.ok(readDb().presets.find((p) => p.id === "voice" ? true : false).filter.attrs.includes("audio"), "новые подборки используют атрибуты");
  });
  await test("кнопка темы: только иконка, без подсказки и подписи", async () => {
    const c = await mkEnv({ view: "stream", id: "thm" }); await wait(40);
    const b = c.byClass("sf-themebtn")[0];
    assert.ok(b.attrs.title === undefined && b.textContent === "" && b.byClass("sf-icon").length === 1);
  });
  await test("смена темы Obsidian сбрасывает выбор темы в виджете на «auto»", async () => {
    let captured = []; global.MutationObserver = class { constructor(cb) { this.cb = cb; captured.push(this); } observe() {} disconnect() {} };
    document.body.classList.add("theme-dark");
    const c = await mkEnv({ view: "stream", id: "thm2", theme: undefined }); await wait(40);
    const root = c.byClass("sf-root")[0];
    c.byClass("sf-themebtn")[0].click(); await wait(20);
    assert.strictEqual(root.dataset.sfTheme, "light", "выбор темы в виджете: светлая (при тёмной теме Obsidian)");
    document.body.classList.remove("theme-dark"); document.body.classList.add("theme-light");   // пользователь переключил тему Obsidian
    captured.at(-1).cb(); await wait(20);
    assert.strictEqual(root.dataset.sfTheme, "auto", "выбор сброшен на глобальную тему");
    await wait(450);
    assert.strictEqual(readDb().ui.theme, "auto");
    document.body.classList.remove("theme-light"); delete global.MutationObserver;
  });
  await test("без фона у виджета и защита от горизонтальной прокрутки (планшет)", async () => {
    const css = document.getElementById("sf-style-" + R("lib/misc").hash(ROOT)).textContent;
    assert.ok(/\.sf-root \{[^}]*background: var\(--sf-root-bg, transparent\)/.test(css), "фон виджета прозрачный");
    assert.ok(/\.sf-root \{[^}]*overflow-x: clip/.test(css) && css.includes(".sf-root.is-forced-desktop { overflow-x: visible; }"));
    assert.ok(/\.sf-daterange \{[^}]*flex-wrap: wrap/.test(css));
  });
  await test("открытие заметки по клику на заголовок", async () => {
    const c = await mkEnv({ view: "stream", id: "open" });
    app.opened.length = 0;
    const t = c.byClass("sf-card__title")[0]; t.dispatch("click", { ctrlKey: true });
    assert.ok(app.opened.length === 1 && app.opened[0][1] === true);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  fs.rmSync(VAULT, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
