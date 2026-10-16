// services/presets.js — смарт-подборки в data/presets.json.
const { uid } = require("lib/misc");

const DEFAULT_PRESETS = [
  { id: "atomic", name: "Атомарные озарения недели", icon: "bolt", description: "Записи с высокой плотностью связей за последние 7 дней", quick: "all", filter: { any: ["мысли", "zettel"], minBacklinks: 3, period: "7d" } },
  { id: "voice", name: "Голосовые черновики", icon: "mic", description: "Аудио-заметки без обработки", quick: "all", filter: { types: ["audio"], not: ["архив"] } },
  { id: "video", name: "Видео-конспекты", icon: "video", description: "Заметки с видео", quick: "all", filter: { types: ["video"] } },
  { id: "quotes", name: "Цитаты", icon: "quote", description: "Выписки и цитаты", quick: "all", filter: { types: ["quote"] } },
  { id: "today", name: "В этот день", icon: "history", description: "Что вы писали в этот день в прошлые годы", quick: "today", filter: {} },
  { id: "random30", name: "Случайная выборка за период", icon: "dice", description: "Рандом из заметок за последние 30 дней — 🎲 перемешивает", quick: "random", filter: { period: "30d" } },
];

module.exports = async function createPresets(storage) {
  let list = await storage.readJson("data/presets.json", null);
  if (!list) { list = DEFAULT_PRESETS; await storage.writeJson("data/presets.json", list); }
  const persist = () => storage.writeJson("data/presets.json", list);
  return {
    list: () => list,
    get: (id) => list.find((p) => p.id === id),
    async save(preset) {
      const p = { ...preset, id: preset.id || uid("flt") };
      const i = list.findIndex((x) => x.id === p.id);
      list = i >= 0 ? list.map((x, j) => (j === i ? p : x)) : [...list, p];
      await persist();
      return p;
    },
    async remove(id) { list = list.filter((p) => p.id !== id); await persist(); },
  };
};
