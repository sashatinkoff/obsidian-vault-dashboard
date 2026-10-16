// scripts/social_feed/view.js — точка входа для dv.view("scripts/social_feed", { ... }).
// Выполняется внутри dataviewjs: доступны dv, app, input. Здесь только bootstrap — вся логика в модулях.
const ROOT = (input && input.root) || "scripts/social_feed";

try {
  // 1) Читаем мини-загрузчик модулей и поднимаем все *.js из папки (кроме core/css/data/tests).
  const loaderCode = await app.vault.adapter.read(`${ROOT}/core/loader.js`);
  const loaderModule = { exports: {} };
  new Function("module", "exports", loaderCode)(loaderModule, loaderModule.exports);
  const loader = loaderModule.exports({ app, root: ROOT });
  const { require: sfRequire } = await loader.load();

  // 2) Запускаем приложение в контейнер dataviewjs-блока.
  await sfRequire("app/main").run({ dv, app, input: input || {}, root: ROOT, container: dv.container });
} catch (e) {
  console.error("[social_feed]", e);
  const pre = dv.container.createEl("pre");
  pre.style.cssText = "white-space:pre-wrap;color:var(--text-error);font-size:12px";
  pre.textContent = "[social_feed] ошибка запуска:\n" + (e && e.stack ? e.stack : e);
}
