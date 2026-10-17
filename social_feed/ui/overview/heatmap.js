// ui/overview/heatmap.js — годовая карта активности: подписи месяцев и дней недели, легенда с диапазонами, сводка.
const { h } = require("lib/dom");
const { heatmap, levelRanges, summary } = require("stats/activity");
const { MONTHS_GEN, fmtDayMonth } = require("lib/date");
const { plural, fmtNum } = require("lib/ru");

const rangeLabel = ([from, to]) => (to === null ? `${from}+` : from === to ? `${from}` : `${from}–${to}`);

module.exports = function activityHeatmap(ctx, byDay, now) {
  const cols = heatmap(byDay, now, 53), max = Math.max(0, ...byDay.values()), ranges = levelRanges(max), sum = summary(byDay);

  // подписи месяцев: ставим над первой неделей месяца
  const months = h("div", { class: "sf-heat__months" });
  let prev = -1;
  cols.forEach((col, i) => {
    const m = new Date(col[0].ts).getMonth();
    if (m !== prev && i < cols.length - 2) months.append(h("span", { class: "sf-heat__month", style: { gridColumn: `${i + 1} / span 3` } }, MONTHS_GEN[m].slice(0, 3)));
    prev = m;
  });

  const grid = h("div", { class: "sf-heat" }, cols.map((col) => h("div", { class: "sf-heat__col" }, col.map((c) =>
    h("span", { class: ["sf-heat__cell", `lv-${c.level}`, c.n > 0 && "is-click"], title: c.level < 0 ? "" : `${c.key}: ${c.n} ${plural(c.n, ["заметка", "заметки", "заметок"])}`, onClick: c.n ? () => ctx.actions.jumpToDay(c.key) : null })))));
  const wrap = h("div", { class: "sf-heat__wrap" },
    h("div", { class: "sf-heat__layout" },
      h("div", { class: "sf-heat__days" }, ["Пн", "", "Ср", "", "Пт", "", "Вс"].map((d) => h("span", null, d))),
      h("div", { class: "sf-heat__main" }, months, grid)));
  setTimeout(() => { wrap.scrollLeft = wrap.scrollWidth; }, 0); // на узком экране сразу видны последние недели

  const legend = h("div", { class: "sf-heat__legend" }, h("span", null, "Меньше"),
    ranges.map((r, i) => h("span", { class: `sf-heat__cell lv-${i}`, title: `${rangeLabel(r)} ${plural(r[1] === null ? 5 : r[1], ["заметка", "заметки", "заметок"])} в день` })),
    h("span", null, "Больше"));

  return h("div", { class: "sf-card-block sf-yearly__heat" },
    h("div", { class: "sf-block__head" },
      h("div", null, h("h3", { class: "sf-block__title" }, "Активность за год"),
        h("p", { class: "sf-block__sub" }, "Каждый квадрат — один день, цвет — сколько заметок создано в этот день. Столбцы — недели (справа — текущая), строки — дни недели. Нажмите на цветной квадрат, чтобы открыть заметки этого дня.")),
      h("div", { class: "sf-block__stat" }, h("strong", null, fmtNum(sum.total)), ` ${plural(sum.total, ["заметка", "заметки", "заметок"])} · ${fmtNum(sum.activeDays)} ${plural(sum.activeDays, ["активный день", "активных дня", "активных дней"])}`,
        sum.best && h("span", null, `Рекорд: ${fmtDayMonth(new Date(sum.best.key + "T00:00:00").getTime())} — ${sum.best.n}`))),
    wrap, legend);
};
