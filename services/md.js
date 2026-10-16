// services/md.js — рендер markdown внутрь элемента. Цепочка запасных вариантов:
// 1) MarkdownRenderer из Obsidian, 2) dv.paragraph с подменой контейнера (через мьютекс), 3) простой текст.
const { createMutex } = require("lib/async");

module.exports = function createMarkdown({ dv, app }) {
  const lock = createMutex();
  let MR = null;
  try { MR = (dv.obsidian && dv.obsidian.MarkdownRenderer) || (window.require && window.require("obsidian").MarkdownRenderer) || null; } catch (e) { MR = null; }

  async function viaObsidian(md, el, path) {
    if (typeof MR.render === "function") await MR.render(app, md, el, path, dv.component);
    else await MR.renderMarkdown(md, el, path, dv.component);
  }
  function viaDv(md, el) {
    return lock(async () => {
      const prev = dv.container;
      dv.container = el;
      try { await dv.paragraph(md); } finally { dv.container = prev; }
    });
  }
  async function render(md, el, path) {
    try {
      if (MR) return await viaObsidian(md, el, path);
      return await viaDv(md, el);
    } catch (e) {
      console.warn("[social_feed] markdown fallback", e);
      el.textContent = md;
    }
  }
  return { render };
};
