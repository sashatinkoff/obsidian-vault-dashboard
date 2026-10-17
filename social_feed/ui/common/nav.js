// ui/common/nav.js — верхняя панель как в dashboard: бренд-чип · вкладки по центру · переключатели справа
// (новая вкладка, полная ширина, тема).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { list } = require("views");
const iconButton = require("ui/common/icon-button");
const versionBadge = require("ui/common/version-badge");

const resolvedTheme = (t) => (t === "auto" ? (document.body && document.body.classList && document.body.classList.contains("theme-dark") ? "dark" : "light") : t);

module.exports = function nav(ctx) {
  const el = h("nav", { class: "sf-nav" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), cur = s.view, dark = resolvedTheme(s.theme) === "dark";
    el.append(
      h("div", { class: "sf-nav__brand" }, icon("bolt", { size: 18 }), h("span", null, "Journal Stream"), icon("unfold", { size: 14, cls: "sf-nav__unfold" })),
      versionBadge(ctx),
      h("div", { class: "sf-nav__tabs" }, list.filter((v) => v.nav !== false).map((v) =>
        h("button", { type: "button", class: ["sf-nav__tab", v.id === cur && "is-active"], onClick: () => ctx.actions.enterView(v.id) }, h("span", null, v.title)))),
      h("div", { class: "sf-nav__right" },
        iconButton({ name: "newtab", title: s.openInNewTab ? "Заметки открываются в новой вкладке" : "Открывать заметки в новой вкладке", active: s.openInNewTab, onClick: () => ctx.actions.setOpenInNewTab(!s.openInNewTab) }),
        iconButton({ name: s.fullWidth ? "shrink" : "expand", title: s.fullWidth ? "Обычная ширина" : "На всю ширину", active: s.fullWidth, onClick: () => ctx.actions.setFullWidth(!s.fullWidth) }),
        h("button", { type: "button", class: "sf-themebtn", title: "Сменить тему: тёмная / светлая", onClick: () => ctx.actions.setTheme(dark ? "light" : "dark") }, icon(dark ? "moon" : "sun", { size: 16 }), h("span", null, dark ? "Тёмная" : "Светлая"))));
  }
  draw();
  ctx.store.subscribe(draw, ["view", "fullWidth", "openInNewTab", "theme"]);
  return el;
};
