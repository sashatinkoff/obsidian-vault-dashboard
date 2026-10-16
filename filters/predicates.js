// filters/predicates.js — отдельные условия фильтра (каждое — чистая функция).
const { inPeriod } = require("filters/periods");
const { dayKey } = require("lib/date");
const tagHit = (postTags, wanted) => postTags.some((t) => t === wanted || t.startsWith(wanted + "/"));

const predicates = {
  any: (p, f) => !f.any.length || f.any.some((t) => tagHit(p.tags, t)),
  all: (p, f) => f.all.every((t) => tagHit(p.tags, t)),
  not: (p, f) => !f.not.some((t) => tagHit(p.tags, t)),
  attrs: (p, f) => f.attrs.every((a) => p.attrs.has(a)),
  types: (p, f) => !f.types.length || f.types.includes(p.type),
  sources: (p, f) => !f.sources.length || f.sources.includes(p.source),
  period: (p, f, now) => inPeriod(p.ts, f.period, now),
  day: (p, f) => !f.day || dayKey(p.ts) === f.day,
  backlinks: (p, f) => p.backlinks >= (f.minBacklinks || 0),
  text: (p, f) => {
    const q = (f.text || "").trim().toLowerCase();
    return !q || p.search.includes(q) || (p.searchBody || "").includes(q);
  },
};
module.exports = { predicates, tagHit };
