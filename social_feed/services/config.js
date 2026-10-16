// services/config.js — настройки: значения по умолчанию + data/config.json (если файла нет — создаётся).
const { deepMerge } = require("lib/misc");

const DEFAULTS = {
  // Источники заметок. folder "" = весь vault (кроме excludeFolders). Можно добавить несколько источников,
  // например { id: "lj", label: "LiveJournal", folder: "notes/LiveJournal" } — тогда в карточках появятся бейджи источников.
  sources: [{ id: "notes", label: "Заметки", folder: "notes", enabled: true }],
  excludeFolders: ["scripts", ".obsidian", "templates"],
  excludeTags: [],
  dateFields: ["date", "Date", "created", "дата", "Дата"],
  favoriteField: "favorite",
  favoriteTags: ["избранное", "favorite"],
  quoteTags: ["цитата", "цитаты", "quote", "quotes"],
  theme: "auto",              // auto | dark | light
  fullWidth: false,           // true: растянуть блок и заметку на всю ширину окна (можно переключать кнопкой в навигации)
  nav: true,                  // верхняя навигация между экранами
  defaultView: "stream",      // overview | stream | bento | collections | studio
  layout: "masonry",          // masonry | flow | timeline (для вида stream)
  pageSize: 24,
  excerptChars: 420,
  randomCount: 12,
  insightsCount: 3,
  topTags: 24,
  concurrency: 8,             // параллельное чтение заметок
  deepScan: false,            // true: прочитать тела всех заметок (точные «Цитаты/Ссылки» в фильтре, но медленнее)
  showSourceBadge: false,   // бейдж источника на карточке (имеет смысл при нескольких источниках)
  dql: { dateExpr: "file.cday" },
};

async function loadConfig(storage) {
  const user = await storage.readJson("data/config.json", null);
  if (user === null) await storage.writeJson("data/config.json", DEFAULTS);
  return deepMerge(DEFAULTS, user || {});
}
module.exports = { DEFAULTS, loadConfig };
