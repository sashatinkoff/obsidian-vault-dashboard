// services/posts.js — репозиторий постов: dv.pages → нормализованные посты (тела не читаются).
const { createPost } = require("model/post");
const types = require("types");
const { toArray } = require("lib/misc");

module.exports = function createPostsRepo({ dv, config }) {
  let cache = null;

  function sourceExpr() {
    const folders = config.sources.filter((s) => s.enabled !== false && s.folder).map((s) => `"${String(s.folder).replace(/"/g, '\\"')}"`);
    const hasRoot = config.sources.some((s) => s.enabled !== false && !s.folder);
    return hasRoot || !folders.length ? "" : folders.join(" or ");
  }
  const excluded = (path) => (config.excludeFolders || []).some((f) => path === f || path.startsWith(f + "/"));

  function collect(force = false) {
    if (cache && !force) return cache;
    const pages = toArray(dv.pages(sourceExpr()));
    const posts = [];
    for (const page of pages) {
      if (!page.file || excluded(page.file.path)) continue;
      const post = createPost(page, config);
      if ((config.excludeTags || []).some((t) => post.tags.includes(t))) continue;
      post.type = types.resolve(post, null).id;
      posts.push(post);
    }
    cache = posts;
    return posts;
  }
  return { collect, refresh: () => collect(true) };
};
