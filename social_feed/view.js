// scripts/social_feed/view.js — точка входа для dv.view("scripts/social_feed", { ... }).
// Выполняется внутри dataviewjs: доступны dv, app, input. Здесь только bootstrap — вся логика в модулях.
const ROOT = (input && input.root) || "scripts/social_feed";

// Стартовая заглушка (шиммеры): пока читаются и подключаются модули, пользователь видит не пустоту, а «скелет» ленты.
// Стили встроены сюда, потому что CSS приложения ещё не загружен; сама заглушка удаляется приложением (app/shell.js).
const boot = document.createElement("div");
boot.className = "sf-boot";
boot.innerHTML = `<style>
  .sf-boot{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px;padding:8px 0}
  .sf-boot i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--background-secondary),var(--background-modifier-border),var(--background-secondary));background-size:200% 100%;animation:sfBoot 1.4s infinite}
  .sf-boot div{display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:16px;background:var(--background-secondary-alt,var(--background-secondary))}
  @keyframes sfBoot{to{background-position:-200% 0}}
</style>${[4, 2, 5, 3, 4, 2].map((n) => `<div><i style="width:40%"></i><i style="width:75%"></i>${Array.from({ length: n }, (_, k) => `<i style="width:${k === n - 1 ? 55 : 100}%"></i>`).join("")}</div>`).join("")}`;
dv.container.appendChild(boot);

try {
  // 1) Читаем мини-загрузчик модулей и поднимаем все *.js из папки (кроме core/css/data/tests).
  const loaderCode = await app.vault.adapter.read(`${ROOT}/core/loader.js`);
  const loaderModule = { exports: {} };
  new Function("module", "exports", loaderCode)(loaderModule, loaderModule.exports);
  const loader = loaderModule.exports({ app, root: ROOT });
  const { require: sfRequire } = await loader.load();

  // 2) Запускаем приложение в контейнер dataviewjs-блока.
  await sfRequire("app/main").run({ dv, app, input: input || {}, root: ROOT, container: dv.container, boot });
} catch (e) {
  console.error("[social_feed]", e);
  boot.remove();
  const pre = dv.container.createEl("pre");
  pre.style.cssText = "white-space:pre-wrap;color:var(--text-error);font-size:12px";
  pre.textContent = "[social_feed] ошибка запуска:\n" + (e && e.stack ? e.stack : e);
}
