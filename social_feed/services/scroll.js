// services/scroll.js — запоминание и восстановление прокрутки заметки с виджетом.
//
// Почему прокрутка «терялась»: при возврате на страницу виджет строится заново, страница на миг становится короткой,
// браузер «зажимает» scrollTop, и это значение перезаписывало сохранённую позицию ещё до восстановления. Поэтому:
//  1) позиция (и высота виджета) фиксируются заранее — при клике по карточке (leave) и при каждой прокрутке;
//  2) пока идёт восстановление (hold), новые значения НЕ сохраняются;
//  3) на время восстановления высота виджета резервируется (min-height из сохранённой), чтобы страница сразу была достаточно длинной;
//  4) восстановление повторяется и «удерживается» ещё 1.5 с — на случай, если Obsidian после рендера сам сдвинет прокрутку;
//  5) события прокрутки от «мёртвого» виджета (заметку уже сменили) игнорируются.
const { debounce } = require("lib/async");

module.exports = function createScroll({ session, key }) {
  let rootEl = null, cancelled = false, frozen = false, held = false, holdTimer = null;
  const listeners = new Set();
  const alive = () => !!rootEl && rootEl.isConnected !== false && (rootEl.offsetHeight === undefined || rootEl.offsetHeight > 0);

  function findScroller() {
    if (!rootEl) return null;
    for (let n = rootEl.parentElement || rootEl.parentNode; n && n.nodeType === 1; n = n.parentElement || n.parentNode) {
      const oy = typeof getComputedStyle === "function" ? getComputedStyle(n).overflowY : "";
      if (oy === "auto" || oy === "scroll" || oy === "overlay") return n;
    }
    return rootEl.closest ? rootEl.closest(".markdown-preview-view, .cm-scroller, .view-content") : null;
  }
  const snapshot = (sc) => session.patch({ scroll: sc.scrollTop, height: rootEl.offsetHeight || undefined });

  const save = debounce((t) => { if (!frozen && !held && alive()) snapshot(t); }, 80);
  const onScroll = (e) => {
    const t = e.target;
    if (!(rootEl && t && t.nodeType === 1 && t.contains && t.contains(rootEl))) return;
    listeners.forEach((cb) => cb(t.scrollTop));
    save(t);
  };
  const onUser = () => { cancelled = true; };
  const USER = ["wheel", "touchmove", "keydown"];

  const g = (window.__sfScrollOff = window.__sfScrollOff || {});
  if (g[key]) g[key]();               // не копим слушатели при повторных перерисовках блока
  if (document.addEventListener) {
    document.addEventListener("scroll", onScroll, true);
    USER.forEach((e) => document.addEventListener(e, onUser, true));
    g[key] = () => { document.removeEventListener("scroll", onScroll, true); USER.forEach((e) => document.removeEventListener(e, onUser, true)); };
  }

  const release = () => { held = false; clearTimeout(holdTimer); };
  return {
    setRoot(el) { rootEl = el; },
    onScroll(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    toTop() { const sc = findScroller(); if (!sc) return; if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" }); else sc.scrollTop = 0; },

    // Приостановить сохранение позиции (вызывается до построения интерфейса, если предстоит восстановление).
    hold() { held = true; clearTimeout(holdTimer); holdTimer = setTimeout(release, 14000); },

    // Восстановить позицию: повторяем, пока страница не станет достаточно высокой, затем удерживаем 1.5 с.
    restore(top, onDone) {
      held = true; cancelled = false; frozen = false;
      clearTimeout(holdTimer); holdTimer = setTimeout(release, 14000);
      const t0 = Date.now(); let okSince = 0;
      const finish = () => { release(); if (onDone) onDone(); };
      const tick = () => {
        if (!top || cancelled) return finish();
        const sc = findScroller();
        if (sc) {
          if (Math.abs(sc.scrollTop - top) >= 2) { sc.scrollTop = top; okSince = 0; }
          else if (!okSince) okSince = Date.now();
        }
        if (okSince && Date.now() - okSince > 1500) return finish();
        if (Date.now() - t0 > 10000) return finish();
        setTimeout(tick, 120);
      };
      tick();
    },

    // Уходим со страницы (клик по карточке): зафиксировать позицию и высоту и больше их не менять.
    leave() { const sc = findScroller(); if (sc && alive() && !held) snapshot(sc); frozen = true; },

    // Вход в раздел: показать верх блока.
    toBlockTop() {
      const sc = findScroller();
      if (!sc || !rootEl.getBoundingClientRect) return;
      const delta = rootEl.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (delta < 0) sc.scrollTop += delta - 8;
      snapshot(sc);
    },
  };
};
