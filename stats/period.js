// stats/period.js — «Пульс месяца»: заметки, дельта, связи, медиа, плотность графа.
const { monthKey } = require("lib/date");

function monthStats(posts, now) {
  const d = new Date(now), cur = monthKey(now), prev = monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime());
  const inCur = posts.filter((p) => monthKey(p.ts) === cur), inPrev = posts.filter((p) => monthKey(p.ts) === prev);
  const links = inCur.reduce((s, p) => s + p.links, 0);
  const kinds = { photo: 0, video: 0, audio: 0 };
  for (const p of inCur) { if (p.mediaKinds.has("image")) kinds.photo++; if (p.mediaKinds.has("video")) kinds.video++; if (p.mediaKinds.has("audio")) kinds.audio++; }
  const isolated = inCur.filter((p) => p.links + p.backlinks === 0).length;
  return {
    count: inCur.length, prevCount: inPrev.length,
    deltaPct: inPrev.length ? Math.round(((inCur.length - inPrev.length) / inPrev.length) * 100) : null,
    links, density: inCur.length ? Math.round((links / inCur.length) * 10) / 10 : 0,
    isolatedPct: inCur.length ? Math.round((isolated / inCur.length) * 100) : 0,
    media: kinds, mediaTotal: kinds.photo + kinds.video + kinds.audio, posts: inCur,
  };
}
module.exports = { monthStats };
