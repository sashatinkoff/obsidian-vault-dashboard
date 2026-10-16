// ui/filters/formula-bar.js — живая формула фильтра с чипами, которые можно удалять.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { toTokens } = require("filters/formula");
const { isDefault, defaultFilter } = require("filters/state");
const chip = require("ui/common/chip");

module.exports = function formulaBar(ctx) {
  const el = h("div", { class: "sf-formula" });
  function draw() {
    clear(el);
    const f = ctx.store.get().filter, tokens = toTokens(f);
    el.append(h("span", { class: "sf-formula__label" }, icon("code", { size: 13 }), "FORMULA"));
    const body = h("div", { class: "sf-formula__body" });
    if (!tokens.length) body.append(h("span", { class: "sf-formula__empty" }, "без условий — выберите теги ниже"));
    for (const t of tokens) {
      if (t.t === "paren") body.append(h("span", { class: "sf-formula__paren" }, t.v));
      else if (t.t === "op") body.append(h("span", { class: ["sf-formula__op", `sf-formula__op--${t.v.toLowerCase()}`] }, t.v));
      else if (t.t === "tag") body.append(chip({ text: t.v, kind: t.mode === "not" ? "not" : "tag", active: true, onRemove: () => ctx.actions.removeTag(t.tag) }));
      else if (t.t === "day") body.append(chip({ text: t.v, kind: "attr", active: true, onRemove: () => ctx.actions.setFilter({ day: "" }) }));
      else body.append(chip({ text: t.v, kind: "attr", active: true, onRemove: () => ctx.actions.toggleAttr(t.attr) }));
    }
    el.append(body);
    if (!isDefault(f)) el.append(h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => ctx.actions.setFilter(defaultFilter()) }, icon("refresh", { size: 13 }), "Сбросить"));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["filter"]);
  return { el, dispose };
};
