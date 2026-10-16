// views/studio.js — «Фильтры · DQL»: визуальный конструктор + живой отклик + генератор DQL.
const { h } = require("lib/dom");
const filterPanel = require("ui/filters/filter-panel");
const metaPanel = require("ui/studio/meta-panel");
const dqlPanel = require("ui/studio/dql-panel");
const livePreview = require("ui/studio/live-preview");

module.exports = {
  id: "studio", title: "Фильтры · DQL", icon: "code",
  async render(ctx, el) {
    const posts = ctx.repo.collect();
    const existing = ctx.store.get().presetId && ctx.presets.get(ctx.store.get().presetId);
    const draft = { id: existing ? existing.id : null, name: existing ? existing.name : "", description: existing ? existing.description || "" : "", icon: existing ? existing.icon || "star" : "star" };

    const meta = metaPanel(ctx, draft);
    const panel = filterPanel(ctx, { posts, variant: "studio" });
    const live = livePreview(ctx, posts);
    const dql = dqlPanel(ctx);

    el.append(
      h("div", { class: "sf-hero" }, h("h1", null, "Конструктор смарт-фильтров"), h("p", null, "Соберите условия мышкой — справа появится готовый Dataview-запрос")),
      h("div", { class: "sf-studio" },
        h("div", { class: "sf-studio__main" }, meta.el, panel.el),
        h("aside", { class: "sf-studio__side" }, live.el, dql.el)));
    return () => [meta, panel, live, dql].forEach((p) => p.dispose());
  },
};
