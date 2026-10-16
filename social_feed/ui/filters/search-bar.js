// ui/filters/search-bar.js — строка поиска: результаты обновляются сразу при вводе.
// Поиск идёт по заголовкам и тегам мгновенно; при первом фокусе в фоне индексируются тексты заметок.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { debounce } = require("lib/async");

module.exports = function searchBar(ctx, { posts }) {
  const status = h("span", { class: "sf-search__status" });
  const apply = debounce((v) => ctx.actions.setFilter({ text: v }), 100);
  let indexing = false;

  async function ensureIndex() {
    if (ctx.indexed || indexing) return;
    indexing = true;
    status.textContent = "индексация…";
    try {
      await ctx.content.preload(posts, (i, n) => { if (i % 20 === 0 || i === n) status.textContent = `индексация ${i}/${n}`; });
      ctx.indexed = true;
    } finally { indexing = false; status.textContent = ""; }
    ctx.actions.setFilter({}); // перерисовать ленту уже с поиском по тексту
  }

  const input = h("input", { class: "sf-input", type: "search", placeholder: "Поиск по заметкам…", value: ctx.store.get().filter.text || "",
    onFocus: ensureIndex,
    onInput: (e) => { clearBtn.style.display = e.target.value ? "" : "none"; apply(e.target.value); },
    onKeydown: (e) => { if (e.key === "Escape") { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } } });
  const clearBtn = h("button", { type: "button", class: "sf-search__clear", title: "Очистить", style: { display: input.value ? "" : "none" }, onClick: () => { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } }, icon("x", { size: 13 }));
  const el = h("div", { class: "sf-search" }, h("div", { class: "sf-input-wrap" }, icon("search", { size: 14 }), input, clearBtn), status);

  // внешний сброс фильтра → очищаем поле (если пользователь не печатает прямо сейчас)
  const dispose = ctx.store.subscribe((s) => {
    if (document.activeElement === input) return;
    if (input.value !== (s.filter.text || "")) { input.value = s.filter.text || ""; clearBtn.style.display = input.value ? "" : "none"; }
  }, ["filter"]);
  return { el, dispose };
};
