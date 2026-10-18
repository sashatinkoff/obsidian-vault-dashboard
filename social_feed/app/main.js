// app/main.js — композиция: данные → конфиг → CSS → сервисы → контекст → оболочка.
const createStorage = require("services/storage");
const createDb = require("services/db");
const { DEFAULTS } = require("services/config");
const { DEFAULT_PRESETS, createPresets } = require("services/presets");
const loadCss = require("services/css-loader");
const createMarkdown = require("services/md");
const createMedia = require("services/media");
const createContent = require("services/content");
const createFlags = require("services/flags");
const createPostsRepo = require("services/posts");
const createSession = require("services/session");
const createIndexer = require("services/indexer");
const createScroll = require("services/scroll");
const createAppState = require("app/state");
const createActions = require("app/actions");
const createOpenNote = require("app/open-note");
const { mountShell } = require("app/shell");
const { VERSION } = require("app/version");

async function run({ dv, app, input, root, container, boot }) {
  const storage = createStorage(app, root);
  const db = await createDb(storage, { settings: DEFAULTS, presets: DEFAULT_PRESETS });
  const config = JSON.parse(JSON.stringify(db.data.settings)); // копия: параметры вызова не пишутся обратно в файл
  if (input.nav === false) config.nav = false;
  await loadCss(storage, root);

  // Ключ сессии: заметка + id блока. Позволяет вернуться на то же место после перехода в другую заметку.
  const session = createSession((dv.currentFilePath || "") + "::" + (input.id || "default"));
  const { store, restored } = createAppState({ db, config, input, session });

  const ctx = { dv, app, root, input, config, storage, db, session, store, restored, boot };
  ctx.flags = createFlags({ db });
  ctx.presets = createPresets({ db });
  ctx.md = createMarkdown({ dv, app });
  ctx.media = createMedia(app);
  ctx.content = createContent({ app, config });
  ctx.repo = createPostsRepo({ dv, config });
  Object.assign(ctx, createOpenNote(ctx));
  ctx.scrollKey = (dv.currentFilePath || "") + "::" + (input.id || "default");
  ctx.scroll = createScroll({ session, key: ctx.scrollKey, log: config.debug ? (...a) => console.log("[social_feed:scroll]", ...a) : undefined });
  ctx.actions = createActions(ctx);
  ctx.indexer = createIndexer(ctx);
  await mountShell(ctx, container);

  // Версия, которой записан файл данных: после обновления кода показываем одно уведомление со ссылкой на историю версий.
  const prev = db.data.appVersion;
  if (prev !== VERSION) {
    db.data.appVersion = VERSION; db.save();
    if (!db.fresh) ctx.toast(prev ? `Journal Stream обновлён: v${prev} → v${VERSION}. Что нового — по ссылке v${VERSION} в навигации` : `Journal Stream обновлён до v${VERSION}. Что нового — по ссылке v${VERSION} в навигации`);
  }
}
module.exports = { run };
