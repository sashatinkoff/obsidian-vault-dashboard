// ui/feed/toolbar.js — верхняя строка экрана: хлебные крошки, счётчик, раскладки, обновление.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const segmented = require("ui/common/segmented");
const iconButton = require("ui/common/icon-button");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");

module.exports = function toolbar(ctx, { title, getCount, withLayouts, onRefresh }) {
  const el = h("div", { class: "sf-toolbar" });
  const counter = h("span", { class: "sf-counter__n" });
  function draw() {
    clear(el);
    const layout = ctx.store.get().layout;
    el.append(
      h("div", { class: "sf-crumbs" }, h("span", null, "Vault"), h("span", { class: "sf-crumbs__sep" }, "/"), h("span", null, "Journal Stream"), h("span", { class: "sf-crumbs__sep" }, "/"), h("span", { class: "sf-crumbs__cur" }, title)),
      h("span", { class: "sf-counter" }, h("span", { class: "sf-counter__dot" }), counter),
      h("div", { class: "sf-toolbar__spacer" }),
      withLayouts && segmented({ options: LAYOUTS, value: layout, onChange: (id) => ctx.actions.setLayout(id) }),
      iconButton({ name: "refresh", title: "Перечитать хранилище", onClick: onRefresh }));
  }
  const setCount = (n) => { counter.textContent = withUnit(n, ["заметка", "заметки", "заметок"]) + " в потоке"; };
  draw();
  const dispose = withLayouts ? ctx.store.subscribe(draw, ["layout"]) : () => {};
  return { el, setCount, dispose };
};
