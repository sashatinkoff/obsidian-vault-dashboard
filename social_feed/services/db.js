// services/db.js — ЕДИНЫЙ файл данных data/social_feed.json: настройки, подборки, избранное/закрепы, UI-предпочтения.
// Удалите этот файл — при следующем открытии он пересоздастся с настройками по умолчанию.
const { deepMerge } = require("lib/misc");
const { debounce } = require("lib/async");

const FILE = "data/social_feed.json";

async function migrateLegacy(storage) {
  // Раньше данные лежали в нескольких файлах — подхватываем их один раз.
  const [settings, presets, flags] = await Promise.all([
    storage.readJson("data/config.json", null), storage.readJson("data/presets.json", null), storage.readJson("data/flags.json", null),
  ]);
  return { settings: settings || undefined, presets: Array.isArray(presets) ? presets : undefined, flags: flags || undefined };
}

module.exports = async function createDb(storage, defaults) {
  let raw = await storage.readJson(FILE, null);
  const fresh = !raw;
  if (fresh) raw = await migrateLegacy(storage);
  // v2: страница по умолчанию на всю ширину; новые ключи подхватываются из defaults
  if (!fresh && (raw.version || 1) < 2 && raw.settings && raw.settings.fullWidth === false) raw.settings.fullWidth = true;
  const data = {
    version: 2,
    appVersion: raw.appVersion,
    settings: deepMerge(defaults.settings, raw.settings || {}),
    ui: raw.ui || {},
    presets: Array.isArray(raw.presets) ? raw.presets : defaults.presets,
    flags: raw.flags || {},
  };
  const save = debounce(() => storage.writeJson(FILE, data), 400);
  if (fresh) await storage.writeJson(FILE, data);
  return { data, save, flush: () => save.flush(), path: FILE, fresh };
};
