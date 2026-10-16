// services/scroll.js — запоминание и восстановление прокрутки заметки с лентой.
const { debounce } = require("lib/async");

module.exports = function createScroll({ container, session }) {
  const host = container.closest ? container.closest(".markdown-preview-view, .cm-scroller, .view-content") : null;
  let cancelled = false;
  const save = debounce(() => session.patch({ scroll: host.scrollTop }), 120);
  const cancel = () => { cancelled = true; };
  const events = ["wheel", "touchstart", "keydown", "mousedown"];

  if (host) {
    if (host.__sfScrollOff) host.__sfScrollOff(); // не копим слушатели при повторных перерисовках блока
    host.addEventListener("scroll", save, { passive: true });
    events.forEach((e) => host.addEventListener(e, cancel, { passive: true }));
    host.__sfScrollOff = () => { host.removeEventListener("scroll", save); events.forEach((e) => host.removeEventListener(e, cancel)); };
  }
  return {
    // Содержимое карточек дорисовывается асинхронно, поэтому пробуем несколько раз, пока страница не станет достаточно высокой.
    restore(top) {
      if (!host || !top) return;
      cancelled = false;
      let tries = 0;
      const tick = () => {
        if (cancelled) return;
        host.scrollTop = top;
        if (Math.abs(host.scrollTop - top) < 2 || ++tries > 40) return;
        setTimeout(tick, 100);
      };
      tick();
    },
    // Прокрутить так, чтобы верх блока был виден (при входе в раздел).
    toBlockTop(el) {
      if (!host || !el.getBoundingClientRect) return;
      const delta = el.getBoundingClientRect().top - host.getBoundingClientRect().top;
      if (delta < 0) host.scrollTop += delta - 8;
      session.patch({ scroll: host.scrollTop });
    },
  };
};
