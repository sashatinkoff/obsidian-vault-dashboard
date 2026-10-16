// views/overview.js — «Обзор»: пульс месяца, активность, теги, случайные озарения, навигация.
const { h } = require("lib/dom");
const { countByDay } = require("stats/activity");
const { fmtNum } = require("lib/ru");
const { defaultFilter } = require("filters/state");
const pulse = require("ui/overview/pulse");
const activityHeatmap = require("ui/overview/heatmap");
const trending = require("ui/overview/trending");
const insights = require("ui/overview/insights");
const tiles = require("ui/overview/tiles");

module.exports = {
  id: "overview", title: "Обзор", icon: "grid",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), now = Date.now(), byDay = countByDay(posts);
    const links = posts.reduce((s, p) => s + p.links, 0);
    el.append(
      h("div", { class: "sf-hero" }, h("h1", null, "Обзор хранилища"), h("p", null, `${fmtNum(posts.length)} заметок и ${fmtNum(links)} исходящих связей`)),
      pulse(posts, byDay, now),
      activityHeatmap(byDay, now, (c) => ctx.store.set({ filter: { ...defaultFilter(), day: c.key }, quick: "all", page: 1, view: "stream" })),
      trending(ctx, posts),
      insights(ctx, posts),
      tiles(ctx));
  },
};
