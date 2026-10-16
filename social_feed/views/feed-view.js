// views/feed-view.js — фабрика экранов-лент (Stream, Bento): тулбар + быстрые режимы + фильтры + лента.
const { h, clear } = require("lib/dom");
const toolbar = require("ui/feed/toolbar");
const quickbar = require("ui/filters/quickbar");
const filterPanel = require("ui/filters/filter-panel");
const feed = require("ui/feed/feed");
const pipeline = require("filters/pipeline");

module.exports = function createFeedView({ id, title, icon, fixedLayout }) {
  return {
    id, title, icon,
    async render(ctx, el) {
      const { store, config } = ctx;
      const posts = ctx.repo.collect();
      store.set({ page: 1 });

      const tb = toolbar(ctx, { title, withLayouts: !fixedLayout, onRefresh: () => { ctx.repo.refresh(); ctx.content.clear(); ctx.reload(); } });
      const qb = quickbar(ctx, { posts });
      const fp = filterPanel(ctx, { posts, variant: "stream" });
      const region = h("div", { class: "sf-feed-region" });
      el.append(tb.el, qb.el, fp.el, region);

      function drawFeed() {
        const s = store.get();
        const { list } = pipeline.run(posts, s, { config, flags: ctx.flags });
        tb.setCount(list.length);
        clear(region);
        region.append(feed(ctx, { posts: list, layout: fixedLayout || s.layout, page: s.page }));
      }
      drawFeed();
      const unsub = store.subscribe(drawFeed, ["filter", "quick", "seed", "layout", "page"]);

      // deepScan: фоновая индексация тел заметок (точные типы/цитаты/поиск по тексту)
      if (config.deepScan && !ctx._deepScanned) {
        ctx._deepScanned = true;
        ctx.content.preload(posts).then(drawFeed).catch((e) => console.warn("[social_feed] deepScan", e));
      }
      return () => { unsub(); tb.dispose(); qb.dispose(); fp.dispose(); };
    },
  };
};
