// ui/common/nav.js — верхняя панель: вкладки на всю ширину шапки + справа версия и переключатели
// (новая вкладка, полная ширина, тема). Бренд-чип убран: он вытеснял вкладки на узких экранах.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { list } = require("views");
const iconButton = require("ui/common/icon-button");
const versionBadge = require("ui/common/version-badge");

const resolvedTheme = (t) => (t === "auto" ? (document.body && document.body.classList && document.body.classList.contains("theme-dark") ? "dark" : "light") : t);

module.exports = function nav(ctx) {
  const el = h("nav", { class: "sf-nav", "aria-label": "Разделы" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), cur = s.view, dark = resolvedTheme(s.theme) === "dark";
    el.append(
      h("div", { class: "sf-nav__tabs", role: "tablist" }, list.filter((v) => v.nav !== false).map((v) =>
        h("button", { type: "button", role: "tab", "aria-selected": v.id === cur ? "true" : "false", class: ["sf-nav__tab", v.short && "has-short", v.id === cur && "is-active"], title: v.title, onClick: () => ctx.actions.enterView(v.id) },
          h("span", { class: "sf-nav__full" }, v.title), v.short && h("span", { class: "sf-nav__short" }, v.short)))),
      h("div", { class: "sf-nav__right" },
        versionBadge(ctx),
        iconButton({ name: "newtab", title: s.openInNewTab ? "Заметки открываются в новой вкладке" : "Открывать заметки в новой вкладке", active: s.openInNewTab, onClick: () => ctx.actions.setOpenInNewTab(!s.openInNewTab) }),
        iconButton({ name: s.fullWidth ? "shrink" : "expand", title: s.fullWidth ? "Обычная ширина" : "На всю ширину", active: s.fullWidth, cls: "sf-nav__fullbtn", onClick: () => ctx.actions.setFullWidth(!s.fullWidth) }),
        h("button", { type: "button", class: "sf-themebtn", title: "Сменить тему: тёмная / светлая", onClick: () => ctx.actions.setTheme(dark ? "light" : "dark") }, icon(dark ? "moon" : "sun", { size: 16 }), h("span", null, dark ? "Тёмная" : "Светлая"))));
  }
  draw();
  ctx.store.subscribe(draw, ["view", "fullWidth", "openInNewTab", "theme"]);
  return el;
};
