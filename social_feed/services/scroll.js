// services/scroll.js — запоминание и восстановление прокрутки заметки с виджетом.
// • Ловим scroll на уровне документа (в capture-фазе) — не важно, какой именно контейнер прокручивается;
// • позицию не сохраняем, пока виджет «мёртв» (при смене заметки Obsidian сбрасывает scrollTop в 0 — это не позиция пользователя);
// • при уходе по клику на карточку позиция фиксируется заранее (leave) и дальнейшие события игнорируются.
const { debounce } = require("lib/async");

module.exports = function createScroll({ session, key }) {
  let rootEl = null, cancelled = false, frozen = false;
  const alive = () => !!rootEl && rootEl.isConnected !== false && (rootEl.offsetHeight === undefined || rootEl.offsetHeight > 0);

  function findScroller() {
    if (!rootEl) return null;
    for (let n = rootEl.parentElement || rootEl.parentNode; n && n.nodeType === 1; n = n.parentElement || n.parentNode) {
      const oy = typeof getComputedStyle === "function" ? getComputedStyle(n).overflowY : "";
      if (oy === "auto" || oy === "scroll" || oy === "overlay") return n;
    }
    return rootEl.closest ? rootEl.closest(".markdown-preview-view, .cm-scroller, .view-content") : null;
  }

  const listeners = new Set();
  const save = debounce((t) => { if (!frozen && alive()) session.patch({ scroll: t.scrollTop }); }, 80);
  const onScroll = (e) => {
    const t = e.target;
    if (!(rootEl && t && t.nodeType === 1 && t.contains && t.contains(rootEl))) return;
    listeners.forEach((cb) => cb(t.scrollTop));
    save(t);
  };
  const onUser = () => { cancelled = true; };
  const USER = ["wheel", "touchstart", "keydown"];

  const g = (window.__sfScrollOff = window.__sfScrollOff || {});
  if (g[key]) g[key]();               // не копим слушатели при повторных перерисовках блока
  if (document.addEventListener) {
    document.addEventListener("scroll", onScroll, true);
    USER.forEach((e) => document.addEventListener(e, onUser, true));
    g[key] = () => { document.removeEventListener("scroll", onScroll, true); USER.forEach((e) => document.removeEventListener(e, onUser, true)); };
  }

  return {
    setRoot(el) { rootEl = el; },
    onScroll(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    toTop() { const sc = findScroller(); if (!sc) return; if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" }); else sc.scrollTop = 0; },
    // Карточки дорисовываются асинхронно — повторяем попытки, пока страница не станет достаточно высокой.
    restore(top) {
      if (!top) return;
      cancelled = false; frozen = false;
      const t0 = Date.now();
      const tick = () => {
        if (cancelled) return;
        const sc = findScroller();
        if (sc) { sc.scrollTop = top; if (Math.abs(sc.scrollTop - top) < 2) return; }
        if (Date.now() - t0 < 8000) setTimeout(tick, 120);
      };
      tick();
    },
    // Уходим со страницы (клик по карточке): зафиксировать позицию и больше её не менять.
    leave() { const sc = findScroller(); if (sc && alive()) session.patch({ scroll: sc.scrollTop }); frozen = true; },
    // Вход в раздел: показать верх блока.
    toBlockTop() {
      const sc = findScroller();
      if (!sc || !rootEl.getBoundingClientRect) return;
      const delta = rootEl.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (delta < 0) sc.scrollTop += delta - 8;
      session.patch({ scroll: sc.scrollTop });
    },
  };
};
