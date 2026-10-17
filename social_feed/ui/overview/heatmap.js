// ui/overview/heatmap.js — годовая матрица активности (53 недели × 7 дней).
const { h } = require("lib/dom");
const { heatmap } = require("stats/activity");
const { plural } = require("lib/ru");

module.exports = function activityHeatmap(byDay, now, onDay) {
  const cols = heatmap(byDay, now, 53);
  const grid = h("div", { class: "sf-heat" }, cols.map((col) => h("div", { class: "sf-heat__col" }, col.map((c) =>
    h("span", { class: ["sf-heat__cell", `lv-${c.level}`], title: c.level < 0 ? "" : `${c.key}: ${c.n} ${plural(c.n, ["заметка", "заметки", "заметок"])}`, onClick: c.n ? () => onDay(c) : null })))));
  const wrap = h("div", { class: "sf-heat__wrap" }, grid);
  setTimeout(() => { wrap.scrollLeft = wrap.scrollWidth; }, 0); // на узком экране сразу видны последние недели
  return h("section", { class: "sf-section" }, h("h2", { class: "sf-section__title" }, "Активность за год"), wrap,
    h("div", { class: "sf-heat__legend" }, "меньше", [0, 1, 2, 3, 4].map((l) => h("span", { class: `sf-heat__cell lv-${l}` })), "больше"));
};
