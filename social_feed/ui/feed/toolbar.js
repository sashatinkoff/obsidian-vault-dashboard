// ui/feed/toolbar.js — верхняя строка экрана: крошки, счётчик, поиск, подборки, раскладки, обновление.
const { h, clear } = require("lib/dom");
const segmented = require("ui/common/segmented");
const iconButton = require("ui/common/icon-button");
const searchBar = require("ui/filters/search-bar");
const presetsMenu = require("ui/filters/presets-menu");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");

module.exports = function toolbar(ctx, { title, posts, withLayouts, onRefresh }) {
  const el = h("div", { class: "sf-toolbar" });
  const counter = h("span", { class: "sf-counter__n" });
  const search = searchBar(ctx, { posts });
  const menu = presetsMenu(ctx, { posts });
  const counterEl = h("span", { class: "sf-counter" }, h("span", { class: "sf-counter__dot" }), counter);

  function draw() {
    clear(el);
    const layout = ctx.store.get().layout;
    el.append(
      h("div", { class: "sf-crumbs" }, h("span", null, "Vault"), h("span", { class: "sf-crumbs__sep" }, "/"), h("span", null, "Journal Stream"), h("span", { class: "sf-crumbs__sep" }, "/"), h("span", { class: "sf-crumbs__cur" }, title)),
      counterEl,
      h("div", { class: "sf-toolbar__spacer" }),
      search.el, menu.el,
      withLayouts && segmented({ options: LAYOUTS, value: layout === "flow" ? "timeline" : layout, onChange: (id) => ctx.actions.setLayout(id) }),
      iconButton({ name: "refresh", title: "Перечитать хранилище", onClick: onRefresh }));
  }
  const setCount = (n) => { counter.textContent = withUnit(n, ["заметка", "заметки", "заметок"]) + " в потоке"; };
  draw();
  const unsub = withLayouts ? ctx.store.subscribe(draw, ["layout"]) : () => {};
  return { el, setCount, dispose: () => { unsub(); search.dispose(); menu.close(); } };
};
