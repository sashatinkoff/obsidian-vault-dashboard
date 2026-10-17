// ui/filters/search-bar.js — поиск по названию или тексту заметок: результаты обновляются сразу при вводе.
// Индексация текстов идёт в фоне (autoIndex) или при первом фокусе; пока она не закончилась, рядом виден прогресс.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { debounce } = require("lib/async");

module.exports = function searchBar(ctx, { posts, placeholder = "Поиск по названию или тексту…", cls = "" }) {
  const status = h("span", { class: "sf-search__status" });
  const apply = debounce((v) => ctx.actions.setFilter({ text: v }), 100);

  const input = h("input", { class: "sf-input", type: "search", placeholder, value: ctx.store.get().filter.text || "", enterkeyhint: "search",
    onFocus: () => ctx.indexer.ensure(posts),
    onInput: (e) => { clearBtn.style.display = e.target.value ? "" : "none"; apply(e.target.value); },
    onKeydown: (e) => { if (e.key === "Escape") { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } } });
  const clearBtn = h("button", { type: "button", class: "sf-search__clear", title: "Очистить", style: { display: input.value ? "" : "none" }, onClick: () => { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } }, icon("x", { size: 13 }));
  const el = h("div", { class: ["sf-search", cls] }, h("div", { class: "sf-input-wrap" }, icon("search", { size: 14 }), input, clearBtn), status);

  const showStatus = (s) => { status.textContent = s.running ? `индексация ${s.i}/${s.n}` : ""; status.title = s.running ? "Пока тексты не проиндексированы, поиск идёт по заголовкам и тегам" : ""; };
  showStatus(ctx.indexer.status());
  const offIndex = ctx.indexer.onChange(showStatus);
  // внешний сброс фильтра → очищаем поле (если пользователь не печатает прямо сейчас)
  const offStore = ctx.store.subscribe((s) => {
    if (document.activeElement === input) return;
    if (input.value !== (s.filter.text || "")) { input.value = s.filter.text || ""; clearBtn.style.display = input.value ? "" : "none"; }
  }, ["filter"]);
  return { el, dispose: () => { offIndex(); offStore(); } };
};
