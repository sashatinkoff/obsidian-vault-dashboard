// app/shell.js — корневой контейнер: тема, навигация, переключение экранов.
const { h, clear } = require("lib/dom");
const nav = require("ui/common/nav");
const views = require("views");

function mountShell(ctx, container) {
  const { store, config } = ctx;
  const root = h("div", { class: "sf-root", dataset: { sfTheme: config.theme, sfView: store.get().view } });
  const region = h("div", { class: "sf-view" });
  root.append(...(config.nav ? [nav(ctx)] : []), region);
  container.appendChild(root);

  // Полная ширина: класс на корне блока + класс на области заметки (снимает ограничение «читаемой длины строки»).
  const host = container.closest ? container.closest(".markdown-preview-view, .markdown-source-view, .view-content") : null;
  function applyWidth() {
    const full = !!store.get().fullWidth;
    root.classList.toggle("is-full", full);
    if (host) host.classList.toggle("sf-page-full", full);
  }
  applyWidth();
  store.subscribe(applyWidth, ["fullWidth"]);

  let dispose = null, token = 0;
  async function show() {
    const my = ++token;
    if (dispose) { try { dispose(); } catch (e) {} dispose = null; }
    clear(region);
    const view = views.get(store.get().view);
    root.dataset.sfView = view.id;
    try {
      const d = await view.render(ctx, region);
      if (my === token) dispose = d; else if (d) d();
    } catch (e) {
      console.error(e);
      region.append(h("pre", { class: "sf-error" }, `[social_feed] ошибка экрана «${view.id}»:\n${e && e.stack ? e.stack : e}`));
    }
  }
  ctx.reload = show;
  ctx.toast = (text) => { const t = h("div", { class: "sf-toast" }, text); root.append(t); setTimeout(() => t.remove(), 2200); };
  store.subscribe(show, ["view"]);
  return show();
}
module.exports = { mountShell };
