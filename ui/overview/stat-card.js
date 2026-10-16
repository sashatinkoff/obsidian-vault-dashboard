// ui/overview/stat-card.js — метрика «Пульса»: заголовок, крупное значение, подпись.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function statCard({ iconName, label, value, unit, sub, trend }) {
  return h("div", { class: "sf-stat" },
    h("div", { class: "sf-stat__head" }, icon(iconName, { size: 15 }), h("span", null, label), trend != null && h("span", { class: ["sf-stat__trend", trend < 0 && "is-down"] }, (trend > 0 ? "+" : "") + trend + "%")),
    h("div", { class: "sf-stat__value" }, value, unit && h("span", { class: "sf-stat__unit" }, unit)),
    sub && h("div", { class: "sf-stat__sub" }, sub));
};
