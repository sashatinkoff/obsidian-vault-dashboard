// app/state.js — реактивное состояние экрана + сохранение в data/state.json (по ключу input.id).
const { createStore } = require("lib/store");
const { debounce } = require("lib/async");
const { newSeed } = require("lib/random");
const { merge } = require("filters/state");

module.exports = async function createAppState({ storage, config, input }) {
  const key = input.id || "default";
  const all = await storage.readJson("data/state.json", {});
  const saved = all[key] || {};
  const store = createStore({
    view: input.view || saved.view || config.defaultView,
    fullWidth: input.fullWidth ?? saved.fullWidth ?? config.fullWidth,
    layout: input.layout || saved.layout || config.layout,
    quick: saved.quick || "all",
    filter: merge(input.filter || saved.filter),
    seed: newSeed(), page: 1, collapsed: !!saved.collapsed, presetId: null,
  });
  const save = debounce(async () => {
    const s = store.get();
    const cur = await storage.readJson("data/state.json", {});
    cur[key] = { view: input.view ? undefined : s.view, layout: s.layout, fullWidth: s.fullWidth, quick: s.quick, filter: s.filter, collapsed: s.collapsed };
    await storage.writeJson("data/state.json", cur);
  }, 600);
  store.subscribe(save, ["view", "layout", "quick", "filter", "collapsed", "fullWidth"]);
  return store;
};
