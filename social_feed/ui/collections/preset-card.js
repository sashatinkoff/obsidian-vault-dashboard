// ui/collections/preset-card.js — карточка смарт-подборки: правила, счётчик, мини-превью, действия.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const chip = require("ui/common/chip");
const richLink = require("ui/common/rich-link");
const pipeline = require("filters/pipeline");
const { ruleChips } = require("filters/presets");
const { merge } = require("filters/state");
const { newSeed } = require("lib/random");
const { fmtNum } = require("lib/ru");

module.exports = function presetCard(ctx, preset, posts) {
  const el = h("article", { class: "sf-preset" });
  let seed = newSeed(), expanded = false;

  function draw() {
    clear(el);
    const { filtered, list } = pipeline.run(posts, { filter: merge(preset.filter), quick: preset.quick || "all", seed }, { config: ctx.config, flags: ctx.flags });
    const total = preset.quick === "random" ? list.length : list.length;
    const preview = list.slice(0, expanded ? 8 : 3);
    el.append(
      h("header", { class: "sf-preset__head" }, h("span", { class: "sf-preset__icon" }, icon(preset.icon || "star", { size: 18 })),
        h("div", { class: "sf-preset__titles" }, h("h3", null, preset.name), h("span", { class: "sf-preset__count" }, `${fmtNum(total)} ${total === 1 ? "заметка" : "заметок"}`)),
        h("div", { class: "sf-preset__tools" },
          preset.quick === "random" && h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", title: "Перемешать", onClick: () => { seed = newSeed(); draw(); } }, icon("dice", { size: 14 })),
          h("button", { type: "button", class: "sf-iconbtn", title: "Редактировать в конструкторе", onClick: () => ctx.actions.editPreset(preset) }, icon("sliders", { size: 15 })))),
      preset.description && h("p", { class: "sf-preset__desc" }, preset.description),
      h("div", { class: "sf-preset__rules" }, ruleChips(preset).map((t) => chip({ text: t, kind: "rule" }))),
      h("div", { class: "sf-preset__preview" }, preview.length ? preview.map((p) => richLink(ctx, p)) : h("span", { class: "sf-muted" }, "Нет подходящих заметок")),
      h("footer", { class: "sf-preset__foot" },
        list.length > 3 && h("button", { type: "button", class: "sf-link", onClick: () => { expanded = !expanded; draw(); } }, expanded ? "Свернуть" : `Показать ещё ${Math.min(5, list.length - 3)}`),
        h("span", { class: "sf-toolbar__spacer" }),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => ctx.actions.openPreset(preset, "bento") }, icon("bento", { size: 13 }), "Бенто"),
        h("button", { type: "button", class: "sf-btn sf-btn--sm", onClick: () => ctx.actions.openPreset(preset, "stream") }, "Открыть как поток", icon("arrowUpRight", { size: 13 }))));
  }
  draw();
  return el;
};
