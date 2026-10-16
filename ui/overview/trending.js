// ui/overview/trending.js — трендовые теги месяца (клик → лента с этим тегом).
const { h } = require("lib/dom");
const { tagCounts } = require("stats/tags");
const chip = require("ui/common/chip");
module.exports = function trending(ctx, posts) {
  const tags = tagCounts(posts, { limit: 14 });
  return h("section", { class: "sf-section" }, h("h2", { class: "sf-section__title" }, "Трендовые теги"),
    h("div", { class: "sf-tagcloud" }, tags.length ? tags.map((t) => chip({ text: "#" + t.tag, count: t.count, onClick: () => ctx.actions.jumpToTag(t.tag) })) : h("span", { class: "sf-muted" }, "Пока нет тегов.")));
};
