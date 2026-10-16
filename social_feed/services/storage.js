// services/storage.js — JSON-хранилище внутри scripts/social_feed/data (через vault adapter).
module.exports = function createStorage(app, root) {
  const adapter = app.vault.adapter;
  const full = (rel) => `${root}/${rel}`;
  async function ensureDir(path) {
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
  }
  return {
    async readJson(rel, fallback) {
      try {
        const p = full(rel);
        if (!(await adapter.exists(p))) return fallback;
        return JSON.parse(await adapter.read(p));
      } catch (e) { console.warn("[social_feed] не удалось прочитать", rel, e); return fallback; }
    },
    async writeJson(rel, data) {
      try { const p = full(rel); await ensureDir(p); await adapter.write(p, JSON.stringify(data, null, 2)); return true; }
      catch (e) { console.warn("[social_feed] не удалось записать", rel, e); return false; }
    },
    async readText(rel) { const p = full(rel); return (await adapter.exists(p)) ? adapter.read(p) : ""; },
    async listFiles(rel) { const p = full(rel); return (await adapter.exists(p)) ? (await adapter.list(p)).files : []; },
  };
};
