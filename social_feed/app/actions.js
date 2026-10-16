// app/actions.js — все изменения состояния в одном месте (UI вызывает только их).
const { toggleTag, removeTag, merge, defaultFilter, toggleIn } = require("filters/state");
const { newSeed } = require("lib/random");
const { toState } = require("filters/presets");

module.exports = function createActions(ctx) {
  const { store } = ctx;
  const filter = () => store.get().filter;
  const setFilter = (patch) => store.set({ filter: merge(filter(), patch), page: 1 });
  return {
    setFilter,
    resetFilter: () => store.set({ filter: defaultFilter(), page: 1, quick: "all", presetId: null }),
    setQuick: (quick) => store.set({ quick, page: 1, presetId: null }),
    shuffle: () => store.set({ seed: newSeed(), page: 1 }),
    toggleTag: (mode, tag) => store.set({ filter: toggleTag(filter(), mode, tag), page: 1 }),
    removeTag: (tag) => store.set({ filter: removeTag(filter(), tag), page: 1 }),
    toggleAttr: (a) => setFilter({ attrs: toggleIn(filter().attrs, a) }),
    toggleType: (t) => setFilter({ types: toggleIn(filter().types, t) }),
    toggleSource: (s) => setFilter({ sources: toggleIn(filter().sources, s) }),
    setView: (view) => store.set({ view }),
    setFullWidth: (fullWidth) => store.set({ fullWidth }),
    setLayout: (layout) => store.set({ layout }),
    setCollapsed: (collapsed) => store.set({ collapsed }),
    nextPage: () => store.set({ page: store.get().page + 1 }),
    // Открыть подборку как поток (или в бенто)
    openPreset(preset, view = "stream") {
      const s = toState(preset);
      store.set({ ...s, page: 1, presetId: preset.id, view });
    },
    // Редактировать подборку в конструкторе / создать новую
    editPreset(preset) { const s = toState(preset); store.set({ ...s, page: 1, presetId: preset.id, view: "studio" }); },
    newPreset() { store.set({ filter: defaultFilter(), quick: "all", page: 1, presetId: null, view: "studio" }); },
    // Клик по тегу из любого экрана: фильтр по тегу в ленте.
    jumpToTag(tag) {
      store.set({ filter: toggleTag(defaultFilter(), "any", tag), quick: "all", page: 1, view: "stream" });
    },
  };
};
