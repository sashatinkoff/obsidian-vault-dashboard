// ui/feed/masonry.js — masonry: карточки разной высоты, каждая попадает в самую короткую колонку,
// поэтому высота «строки» не зависит от самой высокой карточки. Порядок карточек сохраняется (новые — сверху).
const { h, clear } = require("lib/dom");
const { columnCount } = require("lib/layout");
const { debounce } = require("lib/async");

module.exports = function masonry(ctx, cards) {
  const el = h("div", { class: "sf-masonry" }, h("div", { class: "sf-skeleton sf-masonry__loading" }, h("i"), h("i"), h("i")));
  let cols = [], count = 0, placed = [], dead = false, ro = null;
  const width = () => el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 0;

  function build(n) { count = n; clear(el); cols = Array.from({ length: n }, () => h("div", { class: "sf-masonry__col" })); el.append(...cols); }
  const shortest = () => cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
  function place(card) { shortest().append(card); placed.push(card); }
  function relayout() {
    if (dead || !count) return;
    const n = columnCount(width(), ctx.config);
    if (n === count) return;
    const list = placed; placed = []; build(n); list.forEach(place);
  }

  // Карточки добавляются по порядку, как только дорисуются (иначе высоту колонок не измерить).
  (async () => {
    for (const card of cards) {
      await Promise.race([card.sfReady, new Promise((r) => setTimeout(r, 4000))]);
      if (dead) return;
      if (!count) build(columnCount(width(), ctx.config));
      place(card);
    }
  })();

  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(debounce(relayout, 120)); ro.observe(el); }
  el.sfDispose = () => { dead = true; if (ro) ro.disconnect(); };
  return el;
};
