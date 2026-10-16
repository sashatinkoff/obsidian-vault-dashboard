// app/main.js — композиция: конфиг → CSS → сервисы → контекст → оболочка.
const createStorage = require("services/storage");
const { loadConfig } = require("services/config");
const loadCss = require("services/css-loader");
const createMarkdown = require("services/md");
const createMedia = require("services/media");
const createContent = require("services/content");
const createFlags = require("services/flags");
const createPresets = require("services/presets");
const createPostsRepo = require("services/posts");
const createAppState = require("app/state");
const createActions = require("app/actions");
const createOpenNote = require("app/open-note");
const { mountShell } = require("app/shell");

async function run({ dv, app, input, root, container }) {
  const storage = createStorage(app, root);
  const config = await loadConfig(storage);
  if (input.theme) config.theme = input.theme;
  if (input.nav === false) config.nav = false;
  await loadCss(storage, root);
  const [flags, presets, store] = await Promise.all([createFlags({ storage, config }), createPresets(storage), createAppState({ storage, config, input })]);

  const ctx = { dv, app, root, input, config, storage, flags, presets, store };
  ctx.md = createMarkdown({ dv, app });
  ctx.media = createMedia(app);
  ctx.content = createContent({ app, config });
  ctx.repo = createPostsRepo({ dv, config });
  ctx.openNote = createOpenNote(app);
  ctx.actions = createActions(ctx);
  mountShell(ctx, container);
}
module.exports = { run };
