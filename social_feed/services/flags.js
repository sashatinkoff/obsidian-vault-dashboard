// services/flags.js — избранное и закрепы в data/flags.json (файлы заметок не изменяются).
const { debounce } = require("lib/async");

module.exports = async function createFlags({ storage, config }) {
  const data = await storage.readJson("data/flags.json", {});
  const save = debounce(() => storage.writeJson("data/flags.json", data), 400);
  const get = (p) => data[p.path] || {};
  function toggle(p, key) {
    const cur = { ...get(p) };
    if (cur[key]) delete cur[key]; else cur[key] = true;
    if (Object.keys(cur).length) data[p.path] = cur; else delete data[p.path];
    save();
    return !!cur[key];
  }
  return {
    isFavorite: (p) => !!get(p).favorite || p.favoriteMeta,
    isPinned: (p) => !!get(p).pinned,
    toggleFavorite: (p) => toggle(p, "favorite"),
    togglePin: (p) => toggle(p, "pinned"),
    countFavorites: (posts) => posts.filter((p) => !!get(p).favorite || p.favoriteMeta).length,
  };
};
