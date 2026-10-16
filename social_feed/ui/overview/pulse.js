// ui/overview/pulse.js — «Пульс месяца»: 4 метрики.
const { h } = require("lib/dom");
const { MONTHS_NOM } = require("lib/date");
const { monthStats } = require("stats/period");
const { streak } = require("stats/activity");
const { plural, fmtNum } = require("lib/ru");
const statCard = require("ui/overview/stat-card");

module.exports = function pulse(posts, byDay, now) {
  const d = new Date(now), ms = monthStats(posts, now), st = streak(byDay, now);
  const m = ms.media;
  return h("section", { class: "sf-section" },
    h("h2", { class: "sf-section__title" }, `Пульс: ${MONTHS_NOM[d.getMonth()].toLowerCase()} ${d.getFullYear()}`),
    h("div", { class: "sf-stats" },
      statCard({ iconName: "file", label: "Создано заметок", value: fmtNum(ms.count), unit: plural(ms.count, ["заметка", "заметки", "заметок"]), trend: ms.deltaPct, sub: `в прошлом месяце: ${fmtNum(ms.prevCount)}` }),
      statCard({ iconName: "flame", label: "Стрик регулярности", value: st.current, unit: plural(st.current, ["день", "дня", "дней"]) + " подряд", sub: `рекорд: ${st.best}` }),
      statCard({ iconName: "share", label: "Связи", value: fmtNum(ms.links), unit: "исходящих", sub: `${ms.density} связей / заметка · изолированных ${ms.isolatedPct}%` }),
      statCard({ iconName: "image", label: "Медиа", value: fmtNum(ms.mediaTotal), unit: "файлов", sub: `${m.photo} фото · ${m.video} видео · ${m.audio} аудио` })));
};
