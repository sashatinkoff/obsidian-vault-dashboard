// ui/common/version-badge.js — бейдж версии на странице: «v1.0.0», по клику открывает README → «История версий».
const { h } = require("lib/dom");
const { VERSION, RELEASED, CHANGELOG_LINK } = require("app/version");

module.exports = function versionBadge(ctx, { cls = "" } = {}) {
  return h("a", { class: ["sf-version", cls], href: "#", title: `Journal Stream v${VERSION} (${RELEASED}) — история версий в README`,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); ctx.openLink(`${ctx.root}/${CHANGELOG_LINK}`, "", e); } }, "v" + VERSION);
};
