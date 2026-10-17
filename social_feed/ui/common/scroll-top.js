// ui/common/scroll-top.js — плавающая кнопка «Наверх»: появляется после прокрутки вниз.
// Позиционируется через position: sticky внутри области заметки (а не fixed), поэтому не залезает на соседние панели.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function scrollTopButton(ctx) {
  const wrap = h("div", { class: "sf-totop is-hidden" },
    h("button", { type: "button", class: "sf-totop__btn", title: "Наверх", "aria-label": "Прокрутить вверх", onClick: () => ctx.scroll.toTop() }, icon("arrowUp", { size: 18 })));
  ctx.scroll.onScroll((top) => wrap.classList.toggle("is-hidden", top < 400));
  return wrap;
};
