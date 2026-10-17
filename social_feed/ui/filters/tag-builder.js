// ui/filters/tag-builder.js — выбор тегов: тап по чипу ИЛИ ввод с автодополнением (режимы ANY / ALL / NOT).
// Поле ввода — это <form>: «Ввод»/«Готово» на мобильной клавиатуре и кнопка «+» работают одинаково надёжно.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { tagCounts } = require("stats/tags");
const { tagMode, normTag } = require("filters/state");
const chip = require("ui/common/chip");

const MODES = [
  { id: "any", label: "ANY (ИЛИ)" },
  { id: "all", label: "ALL (И)" },
  { id: "not", label: "NOT (НЕ)" },
];

// Подсказки: сначала теги, начинающиеся с введённого, затем содержащие; внутри — по частоте.
function suggestTags(all, query, limit = 8) {
  const q = normTag(query);
  if (!q) return all.slice(0, limit);
  const starts = all.filter((t) => t.tag.startsWith(q)), has = all.filter((t) => !t.tag.startsWith(q) && t.tag.includes(q));
  return [...starts, ...has].slice(0, limit);
}

module.exports = function tagBuilder(ctx, { posts }) {
  const el = h("div", { class: "sf-tagbuilder" });
  const topCounts = tagCounts(posts, { limit: ctx.config.topTags });
  const allTags = tagCounts(posts, { limit: Infinity });
  let mode = "any", active = -1, shown = [];

  // --- постоянная часть (не перерисовывается, чтобы поле ввода не теряло фокус и клавиатура не закрывалась)
  const modeRow = h("div", { class: "sf-tagbuilder__modes" });
  const sug = h("div", { class: "sf-suggest", style: { display: "none" } });
  const input = h("input", { class: "sf-input sf-input--sm sf-tagadd__input", type: "text", placeholder: "Добавить тег…", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "done" });

  function hideSuggest() { sug.style.display = "none"; active = -1; }
  function drawSuggest() {
    clear(sug);
    shown = suggestTags(allTags, input.value);
    const f = ctx.store.get().filter;
    shown.forEach((t, i) => sug.append(h("button", { type: "button", class: ["sf-suggest__item", i === active && "is-active", tagMode(f, t.tag) && "is-used"],
      // mousedown не отдаёт фокус кнопке — поле остаётся активным (важно для мобильной клавиатуры)
      onMousedown: (e) => e.preventDefault(), onClick: () => commit(t.tag) },
      h("span", { class: "sf-suggest__tag" }, "#" + t.tag), h("span", { class: "sf-suggest__count" }, t.count))));
    const typed = normTag(input.value);
    if (typed && !allTags.some((t) => t.tag === typed)) sug.append(h("button", { type: "button", class: "sf-suggest__item sf-suggest__new", onMousedown: (e) => e.preventDefault(), onClick: () => commit(typed) }, "Добавить «#" + typed + "»"));
    sug.style.display = sug.children.length ? "" : "none";
  }
  function commit(raw) {
    const t = normTag(raw);
    if (!t) return;
    ctx.actions.toggleTag(mode, t);
    input.value = ""; hideSuggest();
    if (input.focus) input.focus();
  }

  input.addEventListener("input", () => { active = -1; drawSuggest(); });
  input.addEventListener("focus", drawSuggest);
  input.addEventListener("blur", () => setTimeout(hideSuggest, 160));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      drawSuggest();
    } else if (e.key === "Escape") hideSuggest();
  });
  const form = h("form", { class: "sf-tagadd", autocomplete: "off", onSubmit: (e) => {
    e.preventDefault();
    commit(active >= 0 && shown[active] ? shown[active].tag : input.value);
  } }, input,
  h("button", { type: "submit", class: "sf-iconbtn sf-tagadd__btn", title: "Добавить тег" }, icon("plus", { size: 16 })), sug);

  const head = h("div", { class: "sf-tagbuilder__head" }, h("span", { class: "sf-tagbuilder__title" }, "Теги"), modeRow, form);
  const wrap = h("div", { class: "sf-tagbuilder__tags" });
  el.append(head, wrap);

  function drawModes() {
    clear(modeRow);
    MODES.forEach((m) => modeRow.append(h("button", { type: "button", class: ["sf-modebtn", `sf-modebtn--${m.id}`, m.id === mode && "is-active"], onClick: () => { mode = m.id; drawModes(); drawChips(); } }, m.label)));
  }
  function drawChips() {
    clear(wrap);
    const f = ctx.store.get().filter;
    // выбранные теги всегда видны, даже если их нет среди самых частых
    const extra = [...f.any, ...f.all, ...f.not].filter((t) => !topCounts.some((c) => c.tag === t)).map((t) => ({ tag: t, count: (allTags.find((c) => c.tag === t) || {}).count }));
    for (const { tag, count } of [...topCounts, ...extra]) {
      const m = tagMode(f, tag);
      wrap.append(chip({ text: "#" + tag, count, kind: m === "not" ? "not" : "tag", active: !!m, onClick: () => ctx.actions.toggleTag(mode, tag), title: m ? `в режиме ${m.toUpperCase()} — тап, чтобы снять` : `добавить как ${mode.toUpperCase()}` }));
    }
    if (!wrap.children.length) wrap.append(h("span", { class: "sf-muted" }, "В выбранных источниках нет тегов."));
  }
  drawModes(); drawChips();
  const dispose = ctx.store.subscribe(() => { drawChips(); if (sug.style.display !== "none") drawSuggest(); }, ["filter"]);
  return { el, dispose };
};
module.exports.suggestTags = suggestTags;
