// core/loader.js — мини-загрузчик CommonJS-модулей прямо из vault.
// Читает все *.js из scripts/social_feed (кроме view.js, core/, css/, data/, tests/) и даёт sync-require.
module.exports = function createLoader({ app, root }) {
  const adapter = app.vault.adapter;
  const SKIP_DIRS = new Set(["css", "data", "tests", "docs", "core"]);
  const SKIP_FILES = new Set([root + "/view.js"]);

  async function listJs(dir) {
    const out = [];
    const { files, folders } = await adapter.list(dir);
    for (const f of files) if (f.endsWith(".js") && !SKIP_FILES.has(f)) out.push(f);
    for (const d of folders) {
      const name = d.split("/").pop();
      if (!SKIP_DIRS.has(name)) out.push(...(await listJs(d)));
    }
    return out;
  }

  async function load() {
    const paths = await listJs(root);
    const sources = await Promise.all(paths.map(async (p) => [p, await adapter.read(p)]));
    const defs = new Map();
    for (const [p, code] of sources) defs.set(p.slice(root.length + 1).replace(/\.js$/, ""), { path: p, code });
    const cache = new Map();

    function resolve(fromId, request) {
      let id = request;
      if (request.startsWith(".")) {
        const base = fromId.split("/").slice(0, -1);
        for (const part of request.split("/")) {
          if (part === "." || part === "") continue;
          if (part === "..") base.pop();
          else base.push(part);
        }
        id = base.join("/");
      }
      id = id.replace(/\.js$/, "");
      if (defs.has(id)) return id;
      if (defs.has(id + "/index")) return id + "/index";
      throw new Error(`[social_feed] модуль не найден: "${request}" (импорт из "${fromId}")`);
    }

    function requireFrom(fromId, request) {
      const id = resolve(fromId, request);
      if (cache.has(id)) return cache.get(id).exports;
      const def = defs.get(id);
      const module = { exports: {} };
      cache.set(id, module);
      const fn = new Function("module", "exports", "require", def.code + "\n//# sourceURL=" + def.path);
      fn(module, module.exports, (r) => requireFrom(id, r));
      return module.exports;
    }

    return { require: (request) => requireFrom("<entry>", request), ids: [...defs.keys()] };
  }

  return { load };
};
