// ui/feed/bento.js — bento: CSS-grid с мелкой единицей строки (8px). Высота каждой плитки переводится в число строк
// (grid-row: span N), поэтому строки гибкие и не тянутся под самую высокую плитку; видео и canvas занимают 2 колонки,
// пустоты закрывает grid-auto-flow: dense.
const { h } = require("lib/dom");
const { columnCount } = require("lib/layout");
const { debounce } = require("lib/async");

const ROW = 8;
const WIDE = ["sf-card--video", "sf-card--canvas"];

module.exports = function bento(ctx, cards) {
  const items = cards.map((c) => h("div", { class: "sf-bento__item" }, c));
  const el = h("div", { class: "sf-bento" }, items);
  let cols = 0, dead = false, ro = null;
  const width = () => el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 0;

  function measure(item) {
    const card = item.firstChild;
    const wide = card && WIDE.some((c) => card.classList.contains(c)) && cols > 1;
    item.style.gridColumn = wide ? `span ${Math.min(2, cols)}` : "span 1";
    item.style.gridRowEnd = "auto";
    const hgt = (item.getBoundingClientRect && item.getBoundingClientRect().height) || 0;
    if (hgt) item.style.gridRowEnd = `span ${Math.ceil(hgt / ROW)}`;
  }
  const measureAll = () => items.forEach(measure);
  function relayout() {
    if (dead) return;
    const n = columnCount(width(), ctx.config);
    if (n !== cols) { cols = n; el.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; }
    measureAll();
  }
  cols = columnCount(width(), ctx.config);
  el.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  cards.forEach((c, i) => c.sfReady.then(() => { if (!dead) { cols = columnCount(width(), ctx.config); measure(items[i]); } }));
  // картинки/видео меняют высоту после загрузки — перемеряем ту плитку
  const onMedia = (e) => { const it = e.target && e.target.closest ? e.target.closest(".sf-bento__item") : null; if (it) measure(it); };
  el.addEventListener("load", onMedia, true);
  el.addEventListener("loadedmetadata", onMedia, true);
  setTimeout(() => { if (!dead) measureAll(); }, 900);

  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(debounce(relayout, 120)); ro.observe(el); }
  el.sfDispose = () => { dead = true; if (ro) ro.disconnect(); };
  return el;
};
