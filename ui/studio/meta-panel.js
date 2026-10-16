// ui/studio/meta-panel.js — метаданные подборки: название, описание, иконка, быстрый режим, сохранение.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const modes = require("filters/quick-modes");
const select = require("ui/common/select");
const toast = require("ui/common/toast");
const { defaultFilter } = require("filters/state");

const ICONS = ["bolt", "mic", "video", "quote", "history", "dice", "star", "hash", "file", "link", "tasks", "image", "share"];

module.exports = function metaPanel(ctx, draft) {
  const el = h("section", { class: "sf-meta" });
  function draw() {
    clear(el);
    const quick = ctx.store.get().quick;
    el.append(
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Название подборки"), h("input", { class: "sf-input", type: "text", value: draft.name, placeholder: "Например: Инженерные инсайты", onInput: (e) => (draft.name = e.target.value) })),
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Описание"), h("input", { class: "sf-input", type: "text", value: draft.description, onInput: (e) => (draft.description = e.target.value) })),
      h("div", { class: "sf-field" }, h("label", null, "Режим"), select({ options: modes.MODES.map((m) => ({ id: m.id, label: m.label({ now: Date.now() }) })), value: quick, onChange: (v) => ctx.actions.setQuick(v) })),
      h("div", { class: "sf-field" }, h("label", null, "Иконка"), h("div", { class: "sf-iconpick" }, ICONS.map((i) => h("button", { type: "button", class: ["sf-iconbtn", i === draft.icon && "is-active"], onClick: () => { draft.icon = i; draw(); } }, icon(i, { size: 15 }))))),
      h("div", { class: "sf-meta__actions" },
        h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.resetFilter() }, icon("refresh", { size: 14 }), "Сбросить"),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.openPreset({ id: draft.id, quick: ctx.store.get().quick, filter: ctx.store.get().filter }, "stream") }, "Открыть как поток"),
        h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: async () => {
          const s = ctx.store.get();
          const saved = await ctx.presets.save({ id: draft.id, name: draft.name || "Без названия", description: draft.description, icon: draft.icon, quick: s.quick, filter: s.filter });
          draft.id = saved.id; toast(ctx, "Подборка сохранена в data/presets.json");
        } }, icon("save", { size: 14 }), "Сохранить"),
        draft.id && ctx.presets.get(draft.id) && h("button", { type: "button", class: "sf-btn sf-btn--danger", onClick: async () => { await ctx.presets.remove(draft.id); toast(ctx, "Подборка удалена"); ctx.actions.setView("collections"); } }, icon("trash", { size: 14 }))));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["quick"]) };
};
