// services/config.js — настройки: значения по умолчанию + data/config.json (если файла нет — создаётся).

const DEFAULTS = {
  // Источники заметок. folder "" = весь vault (кроме excludeFolders). Можно добавить несколько источников,
  // например { id: "lj", label: "LiveJournal", folder: "notes/LiveJournal" } — тогда в карточках появятся бейджи источников.
  sources: [{ id: "notes", label: "Заметки", folder: "notes", enabled: true }],
  excludeFolders: ["scripts", ".obsidian", "templates"],
  excludeTags: [],
  dateFields: ["date", "Date", "created", "Created", "дата", "Дата", "datetime", "Дата и время", "published"],
  timeFallback: "none",       // none | ctime | mtime — откуда брать время, если в дате заметки его нет
  openInNewTab: false,        // открывать заметку по клику на карточку в новой вкладке (Ctrl/Cmd+клик — всегда в новой)
  favoriteField: "favorite",
  favoriteTags: ["избранное", "favorite"],
  quoteTags: ["цитата", "цитаты", "quote", "quotes"],
  theme: "auto",              // auto | dark | light
  fullWidth: true,            // true: растянуть блок и заметку на всю ширину окна (можно переключать кнопкой в навигации)
  nav: true,                  // верхняя навигация между экранами
  defaultView: "stream",      // overview | stream | bento | collections | studio
  layout: "masonry",          // masonry | flow | timeline (для вида stream)
  columns: { min: 2, max: 4 }, // колонки карточек на десктопе (masonry и бенто); на телефоне всегда 1
  minCardWidth: 320,          // минимальная ширина карточки в px — по ней считается, сколько колонок помещается
  pageSize: 24,
  pageSizeMobile: 12,         // сколько карточек за раз на телефоне (одна колонка)
  singleColumnBelow: 560,     // ширина блока (px), ниже которой лента — в один столбец и включается мобильный интерфейс
  excerptChars: 420,
  randomCount: 12,
  insightsCount: 3,
  topTags: 24,
  concurrency: 8,             // параллельное чтение заметок
  deepScan: false,            // true: прочитать тела всех заметок (точные «Цитаты/Ссылки» в фильтре, но медленнее)
  showSourceBadge: false,   // бейдж источника на карточке (имеет смысл при нескольких источниках)
  dql: { dateExpr: "file.cday" },
};

module.exports = { DEFAULTS };
