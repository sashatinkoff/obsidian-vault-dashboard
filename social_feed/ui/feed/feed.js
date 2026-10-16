// ui/feed/feed.js — лента карточек выбранной раскладки (masonry / flow / timeline / bento) + пагинация.
const { h } = require("lib/dom");
const createCard = require("ui/card/card");
const groupByDay = require("ui/feed/groups");
const loadMore = require("ui/feed/load-more");
const empty = require("ui/common/empty");

module.exports = function feed(ctx, { posts, layout, page }) {
  const wrap = h("section", { class: ["sf-feed", `sf-feed--${layout}`] });
  if (!posts.length) {
    wrap.append(empty({ title: "Ничего не найдено", hint: "Ослабьте фильтры или выберите другой быстрый режим.", action: h("button", { type: "button", class: "sf-btn", onClick: () => ctx.actions.resetFilter() }, "Сбросить фильтры") }));
    return wrap;
  }
  const size = ctx.config.pageSize, visible = posts.slice(0, size * page);

  if (layout === "timeline") {
    for (const g of groupByDay(visible)) {
      wrap.append(h("div", { class: "sf-timeline__group" },
        h("div", { class: "sf-timeline__label" }, h("span", { class: "sf-timeline__dot" }), g.label, h("span", { class: "sf-timeline__key" }, g.date)),
        h("div", { class: "sf-timeline__items" }, g.posts.map((p) => createCard(ctx, p)))));
    }
  } else wrap.append(h("div", { class: "sf-feed__grid" }, visible.map((p) => createCard(ctx, p))));

  if (posts.length > visible.length) wrap.append(loadMore({ remaining: posts.length - visible.length, onClick: () => ctx.actions.nextPage() }));
  return wrap;
};
