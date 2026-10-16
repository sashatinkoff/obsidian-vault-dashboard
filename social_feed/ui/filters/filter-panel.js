// ui/filters/filter-panel.js — сборка панели фильтров. variant: "stream" (сворачиваемая) | "studio" (всё раскрыто).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const formulaBar = require("ui/filters/formula-bar");
const tagBuilder = require("ui/filters/tag-builder");
const attrToggles = require("ui/filters/attr-toggles");
const advanced = require("ui/filters/advanced");

module.exports = function filterPanel(ctx, { posts, variant = "stream" }) {
  const el = h("section", { class: ["sf-panel", `sf-panel--${variant}`] });
  const parts = [formulaBar(ctx), tagBuilder(ctx, { posts }), attrToggles(ctx), advanced(ctx, { withSearch: variant === "studio" })];
  const [formula, tags, attrs, adv] = parts;
  let showAdv = variant === "studio";

  const toggle = h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm sf-panel__toggle" });
  const details = h("div", { class: "sf-panel__details" }, tags.el, attrs.el, adv.el);
  const advWrap = adv.el;

  function draw() {
    const collapsed = variant === "stream" && ctx.store.get().collapsed;
    el.classList.toggle("is-collapsed", collapsed);
    advWrap.style.display = showAdv ? "" : "none";
    clear(toggle);
    toggle.append(icon("chevron", { size: 13, cls: collapsed ? "" : "sf-flip" }), collapsed ? "Развернуть панель" : "Свернуть в 1 строку");
  }
  toggle.addEventListener("click", () => ctx.actions.setCollapsed(!ctx.store.get().collapsed));
  const advBtn = h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => { showAdv = !showAdv; draw(); } }, icon("sliders", { size: 13 }), "Условия");

  const head = h("div", { class: "sf-panel__head" }, formula.el, variant === "stream" ? h("div", { class: "sf-panel__actions" }, advBtn, toggle) : null);
  el.append(head, details);
  draw();
  const unsub = ctx.store.subscribe(draw, ["collapsed"]);
  return { el, dispose: () => { unsub(); parts.forEach((p) => p.dispose()); } };
};
