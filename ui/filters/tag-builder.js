// ui/filters/tag-builder.js — «Zero-Typing»: тап по тегу добавляет его в режиме ИЛИ / И / НЕ.
const { h, clear } = require("lib/dom");
const { tagCounts } = require("stats/tags");
const { tagMode, normTag } = require("filters/state");
const chip = require("ui/common/chip");

const MODES = [
  { id: "any", label: "ANY (ИЛИ)" },
  { id: "all", label: "ALL (И)" },
  { id: "not", label: "NOT (НЕ)" },
];

module.exports = function tagBuilder(ctx, { posts }) {
  const el = h("div", { class: "sf-tagbuilder" });
  const counts = tagCounts(posts, { limit: ctx.config.topTags });
  let mode = "any";

  function draw() {
    clear(el);
    const f = ctx.store.get().filter;
    const modeRow = h("div", { class: "sf-tagbuilder__modes" }, MODES.map((m) =>
      h("button", { type: "button", class: ["sf-modebtn", `sf-modebtn--${m.id}`, m.id === mode && "is-active"], onClick: () => { mode = m.id; draw(); } }, m.label)));
    const input = h("input", { class: "sf-input sf-input--sm", type: "text", placeholder: "#тег + Enter", onKeydown: (e) => {
      if (e.key !== "Enter") return;
      const t = normTag(e.target.value);
      if (t) { ctx.actions.toggleTag(mode, t); e.target.value = ""; }
    } });
    el.append(h("div", { class: "sf-tagbuilder__head" }, h("span", { class: "sf-tagbuilder__title" }, "Быстрый выбор тегов"), modeRow, input));
    const wrap = h("div", { class: "sf-tagbuilder__tags" });
    for (const { tag, count } of counts) {
      const m = tagMode(f, tag);
      wrap.append(chip({ text: "#" + tag, count, kind: m === "not" ? "not" : "tag", active: !!m, onClick: () => ctx.actions.toggleTag(mode, tag), title: m ? `в режиме ${m.toUpperCase()} — тап, чтобы снять` : `добавить как ${mode.toUpperCase()}` }));
    }
    if (!counts.length) wrap.append(h("span", { class: "sf-muted" }, "В выбранных источниках нет тегов."));
    el.append(wrap);
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["filter"]);
  return { el, dispose };
};
