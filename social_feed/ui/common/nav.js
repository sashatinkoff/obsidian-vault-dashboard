// ui/common/nav.js — верхняя навигация между экранами.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { list } = require("views");
const iconButton = require("ui/common/icon-button");

module.exports = function nav(ctx) {
  const el = h("nav", { class: "sf-nav" });
  function draw() {
    clear(el);
    const cur = ctx.store.get().view;
    el.append(h("div", { class: "sf-nav__brand" }, icon("bolt", { size: 16 }), h("span", null, "Journal Stream")));
    const full = ctx.store.get().fullWidth;
    const tabs = h("div", { class: "sf-nav__tabs" }, list.filter((v) => v.nav !== false).map((v) =>
      h("button", { type: "button", class: ["sf-nav__tab", v.id === cur && "is-active"], onClick: () => ctx.actions.setView(v.id) }, icon(v.icon, { size: 14 }), h("span", null, v.title))));
    el.append(tabs, h("span", { class: "sf-toolbar__spacer" }), iconButton({ name: full ? "shrink" : "expand", title: full ? "Обычная ширина" : "На всю ширину", active: full, onClick: () => ctx.actions.setFullWidth(!full) }));
  }
  draw();
  ctx.store.subscribe(draw, ["view", "fullWidth"]);
  return el;
};
