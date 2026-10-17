// views/feed-view.js — фабрика экранов-лент (Лента, Бенто): тулбар (поиск, подборки) + быстрые режимы + фильтры + лента.
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

      const tb = toolbar(ctx, { title, posts, withLayouts: !fixedLayout, onRefresh: () => { ctx.repo.refresh(); ctx.content.clear(); ctx.indexer.reset(); ctx.reload(); } });
      const qb = quickbar(ctx, { posts });
      const fp = filterPanel(ctx, { posts, variant: "stream" });
      const region = h("div", { class: "sf-feed-region" });
      el.append(tb.el, qb.el, fp.el, region);

      let current = null;
      let keepTimer = null;
      function drawFeed() {
        const s = store.get();
        // Пока лента перестраивается, держим прежнюю высоту — иначе страница «схлопывается» и прокрутка прыгает вверх.
        const prevH = region.offsetHeight;
        if (prevH) { region.style.minHeight = prevH + "px"; clearTimeout(keepTimer); keepTimer = setTimeout(() => { region.style.minHeight = ""; }, 700); }
        const { list } = pipeline.run(posts, s, { config, flags: ctx.flags });
        tb.setCount(list.length);
        if (current && current.sfDispose) current.sfDispose();
        clear(region);
        current = feed(ctx, { posts: list, layout: fixedLayout || s.layout, page: s.page });
        region.append(current);
      }
      drawFeed();
      let unsub = store.subscribe(drawFeed, ["filter", "quick", "seed", "layout", "page"]);

      // Фоновая индексация текстов (поиск по тексту, точные типы/цитаты): сразу при deepScan, иначе — когда браузер свободен
      if (config.deepScan || config.autoIndex !== false) {
        const start = () => ctx.indexer.ensure(posts).then(drawFeed).catch((e) => console.warn("[social_feed] индексация", e));
        const t = setTimeout(start, config.deepScan ? 0 : 600);
        const prev = unsub;
        unsub = () => { clearTimeout(t); prev(); };
      }
      return () => { clearTimeout(keepTimer); unsub(); if (current && current.sfDispose) current.sfDispose(); tb.dispose(); qb.dispose(); fp.dispose(); };
    },
  };
};
