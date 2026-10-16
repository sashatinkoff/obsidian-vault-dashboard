// views/collections.js — «Подборки»: галерея сохранённых смарт-фильтров (data/presets.json).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const presetCard = require("ui/collections/preset-card");
const { plural } = require("lib/ru");

module.exports = {
  id: "collections", title: "Подборки", icon: "star",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), list = ctx.presets.list();
    el.append(
      h("div", { class: "sf-hero sf-hero--row" },
        h("div", null, h("h1", null, "Смарт-подборки"), h("p", null, `${list.length} ${plural(list.length, ["сохранённая подборка", "сохранённые подборки", "сохранённых подборок"])} · автоматическая выборка`)),
        h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: () => ctx.actions.newPreset() }, icon("plus", { size: 14 }), "Новый смарт-фильтр")),
      h("div", { class: "sf-presets" }, list.map((p) => presetCard(ctx, p, posts))));
  },
};
