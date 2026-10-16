// ui/overview/insights.js — «Случайные озарения»: N карточек из всего архива, 🎲 перемешивает.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { shuffle, newSeed } = require("lib/random");
const createCard = require("ui/card/card");

module.exports = function insights(ctx, posts) {
  const box = h("div", { class: "sf-insights" });
  let seed = newSeed();
  function draw() {
    clear(box);
    const pick = shuffle(posts, seed).slice(0, ctx.config.insightsCount);
    if (!pick.length) box.append(h("span", { class: "sf-muted" }, "Нет заметок для выборки."));
    pick.forEach((p) => box.append(createCard(ctx, p)));
  }
  draw();
  return h("section", { class: "sf-section" },
    h("div", { class: "sf-section__row" }, h("h2", { class: "sf-section__title" }, "Случайные озарения"),
      h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => { seed = newSeed(); draw(); } }, icon("dice", { size: 14 }), "Перемешать")), box);
};
