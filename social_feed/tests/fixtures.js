// tests/fixtures.js — тестовое «хранилище»: заметки + моки dv/app поверх файловой системы.
const fs = require("fs");
const path = require("path");
const DAY = 86400000, now = Date.now();
const iso = (off, time = "10:30") => { const d = new Date(now - off * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${time}`; };
const lastYear = (() => { const d = new Date(now); return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:00`; })();

const NOTES = [
  { path: "notes/LiveJournal/2026/a.md", date: iso(0), tags: ["#мысли", "#daily"], body: "Утренние мысли про [[Zettelkasten]] и атомарность.\n\nВторой абзац.", inl: 4, out: ["Zettelkasten.md"] },
  { path: "notes/LiveJournal/2026/quote.md", date: iso(1), tags: ["#цитаты"], body: "> [!quote] Барри Шварц\n> Свобода выбора без жестких ограничений превращается в паралич мышления.\n", inl: 11 },
  { path: "notes/Twitter/2026/voice.md", date: iso(2), tags: ["#audio", "#черновик"], body: "Аудиозапись мысли\n![[rec-001.m4a]]", out: ["rec-001.m4a"] },
  { path: "notes/Twitter/2026/video.md", date: iso(3), tags: ["#видео", "#разбор"], body: "# Стрим\n![[stream.mp4]]\nКонспект про CRDT.", out: ["stream.mp4"], inl: 5 },
  { path: "notes/Twitter/2026/photos.md", date: iso(4), tags: ["#daily"], body: "Фото дня\n![[1.jpg]] ![[2.jpg]] ![[3.png]] ![[4.png]] ![[5.webp]]", out: ["1.jpg", "2.jpg", "3.png", "4.png", "5.webp"] },
  { path: "notes/LiveJournal/2026/tasks.md", date: iso(5), tags: ["#проекты"], body: "- [x] Разгрузить inbox\n- [ ] Перелинковать заметки\n- [ ] Ещё одна", tasks: 3 },
  { path: "notes/Twitter/2026/link.md", date: iso(6), tags: ["#dev"], body: "Читать: https://example.com/article/crdt", },
  { path: "notes/LiveJournal/2026/canvas.md", date: iso(7), tags: ["#zettelkasten", "#obsidian"], body: "Карта\n![[system_map.canvas]]", out: ["system_map.canvas"] },
  { path: "notes/LiveJournal/2025/old.md", date: lastYear, tags: ["#мысли"], body: "Заметка годичной давности. Подробно о себе и о том, что было." },
  { path: "notes/LiveJournal/2024/ru-date.md", date: "1 октября 2024, 16:12", tags: ["#мысли"], body: "Дата в формате самих заметок." },
  { path: "notes/LiveJournal/2024/2024-03-02.md", date: null, tags: [], body: "Без даты в frontmatter, дата в имени файла." },
];

function makeDv(container) {
  const arr = (a) => a;
  const pages = NOTES.map((n) => {
    const name = path.basename(n.path, ".md");
    const page = { file: { path: n.path, name, tags: arr(n.tags || []), inlinks: arr(Array.from({ length: n.inl || 0 }, (_, i) => ({ path: "x" + i }))), outlinks: arr((n.out || []).map((p) => ({ path: p }))), tasks: arr(Array.from({ length: n.tasks || 0 })), size: n.body.length, mtime: new Date(now), cday: new Date(now - 30 * DAY), ctime: new Date(now) } };
    if (n.date) page.date = n.date;
    return page;
  });
  return { container, component: {}, pages: () => pages, paragraph: async (md) => { container.append(document.createTextNode(md)); } };
}

function makeApp(vaultRoot) {
  const abs = (p) => path.join(vaultRoot, p);
  const byPath = Object.fromEntries(NOTES.map((n) => [n.path, n]));
  const opened = [];
  return {
    opened,
    vault: {
      adapter: {
        read: async (p) => fs.readFileSync(abs(p), "utf8"),
        write: async (p, d) => { fs.mkdirSync(path.dirname(abs(p)), { recursive: true }); fs.writeFileSync(abs(p), d); },
        exists: async (p) => fs.existsSync(abs(p)),
        mkdir: async (p) => fs.mkdirSync(abs(p), { recursive: true }),
        list: async (p) => {
          const ents = fs.readdirSync(abs(p), { withFileTypes: true });
          return { files: ents.filter((e) => e.isFile()).map((e) => p + "/" + e.name), folders: ents.filter((e) => e.isDirectory()).map((e) => p + "/" + e.name) };
        },
      },
      getAbstractFileByPath: (p) => (byPath[p] ? { path: p, stat: { mtime: 1 } } : null),
      cachedRead: async (f) => (byPath[f.path].date ? `---\ndate: ${byPath[f.path].date}\n---\n` : "") + byPath[f.path].body,
      getResourcePath: (f) => "app://local/" + f.path,
    },
    metadataCache: { getFirstLinkpathDest: (t) => ({ path: t }) },
    workspace: { openLinkText: (p, _s, nt) => opened.push([p, nt]) },
  };
}
module.exports = { NOTES, makeDv, makeApp };
