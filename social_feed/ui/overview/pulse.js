// ui/overview/pulse.js — «Пульс месяца»: заметки, стрик, фото, видео, связи.
const { h } = require("lib/dom");
const { MONTHS_NOM } = require("lib/date");
const { monthStats } = require("stats/period");
const { streak } = require("stats/activity");
const { plural, fmtNum } = require("lib/ru");
const statCard = require("ui/overview/stat-card");

const inNotes = (n) => (n ? `в ${fmtNum(n)} ${plural(n, ["заметке", "заметках", "заметках"])}` : "в этом месяце не добавлялись");

module.exports = function pulse(posts, byDay, now) {
  const d = new Date(now), ms = monthStats(posts, now), st = streak(byDay, now);
  return h("section", { class: "sf-section" },
    h("h2", { class: "sf-section__title" }, `Пульс: ${MONTHS_NOM[d.getMonth()].toLowerCase()} ${d.getFullYear()}`),
    h("div", { class: "sf-stats" },
      statCard({ iconName: "file", label: "Создано заметок", value: fmtNum(ms.count), unit: plural(ms.count, ["заметка", "заметки", "заметок"]), trend: ms.deltaPct, sub: `в прошлом месяце: ${fmtNum(ms.prevCount)}` }),
      statCard({ iconName: "flame", label: "Стрик регулярности", value: st.current, unit: plural(st.current, ["день", "дня", "дней"]) + " подряд", sub: `рекорд: ${st.best}` }),
      statCard({ iconName: "image", label: "Добавлено фото", value: fmtNum(ms.media.photo), unit: plural(ms.media.photo, ["фото", "фото", "фото"]), sub: inNotes(ms.mediaNotes.photo) }),
      statCard({ iconName: "video", label: "Добавлено видео", value: fmtNum(ms.media.video), unit: plural(ms.media.video, ["видео", "видео", "видео"]), sub: inNotes(ms.mediaNotes.video) }),
      statCard({ iconName: "share", label: "Связи", value: fmtNum(ms.links), unit: "исходящих", sub: `${ms.density} связей / заметка · изолированных ${ms.isolatedPct}%` })));
};
