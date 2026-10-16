// ui/card/bodies/_excerpt.js — общий рендер текстового превью (markdown, с обрезкой и «Читать далее»).
const { h } = require("lib/dom");
const { cleanForExcerpt, truncateMarkdown } = require("lib/text");

// Тело заметки без цитат/задач — чтобы не дублировать то, что уже показано отдельным блоком.
function bodyWithout(body, { quotes = false, tasks = false } = {}) {
  const lines = String(body || "").split(/\r?\n/).filter((l) => !(quotes && /^\s*>/.test(l)) && !(tasks && /^\s*[-*+]\s+\[[ xX]\]/.test(l)));
  return cleanForExcerpt(lines.join("\n"));
}

async function renderExcerpt(ctx, post, feats, parent, opts = {}) {
  const src = opts.quotes || opts.tasks ? bodyWithout(feats.body, opts) : feats.text;
  if (!src) return null;
  const max = opts.max || ctx.config.excerptChars;
  const { text, truncated } = truncateMarkdown(src, max);
  const box = h("div", { class: "sf-card__text markdown-rendered" });
  parent.append(box);
  await ctx.md.render(text, box, post.path);
  if (truncated) parent.append(h("a", { class: "sf-card__more", href: "#", onClick: (e) => { e.preventDefault(); ctx.openNote(post.path, e); } }, "Читать далее"));
  return box;
}
module.exports = { renderExcerpt, bodyWithout };
