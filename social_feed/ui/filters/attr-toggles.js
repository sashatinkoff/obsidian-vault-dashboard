// ui/filters/attr-toggles.js — атрибуты и типы карточек (С медиа / Цитаты / Задачи …).
const { h, clear } = require("lib/dom");
const { ATTRS } = require("filters/attrs");
const types = require("types");
const chip = require("ui/common/chip");

module.exports = function attrToggles(ctx) {
  const el = h("div", { class: "sf-attrs" });
  function draw() {
    clear(el);
    const f = ctx.store.get().filter;
    el.append(h("span", { class: "sf-attrs__label" }, "Атрибуты:"));
    for (const a of ATTRS) el.append(chip({ text: a.label, kind: "attr", iconName: a.icon, active: f.attrs.includes(a.id), onClick: () => ctx.actions.toggleAttr(a.id) }));
    el.append(h("span", { class: "sf-attrs__sep" }));
    el.append(h("span", { class: "sf-attrs__label" }, "Тип:"));
    for (const t of types.list.filter((x) => x.id !== "text" || true)) el.append(chip({ text: t.label, kind: "attr", iconName: t.icon, active: f.types.includes(t.id), onClick: () => ctx.actions.toggleType(t.id) }));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["filter"]);
  return { el, dispose };
};
