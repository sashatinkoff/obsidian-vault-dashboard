// ui/overview/tiles.js — плитки-переходы в рабочие пространства.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const TILES = [
  { view: "stream", icon: "rows", title: "Поток", text: "Хронологическая лента: masonry, flow, timeline" },
  { view: "bento", icon: "bento", title: "Bento Grid", text: "Модульная сетка с акцентными карточками" },
  { view: "collections", icon: "star", title: "Подборки", text: "Сохранённые смарт-фильтры в 1 клик" },
  { view: "studio", icon: "code", title: "Фильтры · DQL", text: "Конструктор и генератор Dataview-запросов" },
];
module.exports = function tiles(ctx) {
  return h("section", { class: "sf-section" }, h("h2", { class: "sf-section__title" }, "Пространства"),
    h("div", { class: "sf-tiles" }, TILES.map((t) => h("button", { type: "button", class: "sf-tile", onClick: () => ctx.actions.enterView(t.view) }, icon(t.icon, { size: 20 }), h("span", { class: "sf-tile__title" }, t.title), h("span", { class: "sf-tile__text" }, t.text)))));
};
