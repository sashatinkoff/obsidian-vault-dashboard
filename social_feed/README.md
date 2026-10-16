# Social Feed для Obsidian (Dataview)

Лента заметок в виде карточек «как в соцсети» по макетам *Obsidian Journal / Obsidian Stream*:
поток (masonry / flow / timeline), Bento-сетка, смарт-подборки, конструктор фильтров с генератором DQL, обзор с пульсом месяца.
Работает на **dataviewjs** без плагинов-посредников: весь код, данные и CSS лежат в `scripts/social_feed`.

## Быстрый старт

1. Нужен плагин **Dataview** с включённым **JavaScript Queries** (Settings → Dataview → Enable JavaScript Queries).
2. Скопируйте папку `social_feed` в `<vault>/scripts/social_feed`.
3. Создайте заметку и вставьте:

````markdown
---
cssclasses: sf-page
---

```dataviewjs
await dv.view("scripts/social_feed", { view: "stream" })
```
````

`cssclasses: sf-page` растягивает заметку до 1600px (ширина по умолчанию в Obsidian слишком узкая для сетки). Чтобы вывести ленту **на всю ширину окна**, нажмите ⤢ в навигации, передайте `fullWidth: true` или укажите `cssclasses: sf-page-full` — подробности в разделе про `fullWidth` ниже.
Готовый пример — `example-note.md`.

4. Откройте `data/config.json` и поменяйте `sources` на свои папки (по умолчанию одна папка `notes`; `"folder": ""` — весь vault; при нескольких источниках включите `showSourceBadge`).

## Параметры вызова

```js
await dv.view("scripts/social_feed", {
  view: "stream",          // overview | stream | bento | collections | studio (по умолчанию config.defaultView)
  id: "main",              // ключ сохранения состояния; у разных заметок/блоков задавайте разные
  nav: true,               // верхняя навигация между экранами (false — «чистый» экран без вкладок)
  layout: "masonry",       // masonry | flow | timeline
  theme: "auto",           // auto | dark | light
  fullWidth: true,         // на всю ширину окна (по умолчанию false; есть кнопка ⤢ в навигации)
  filter: { any: ["мысли"], period: "30d" },  // стартовый фильтр (формат — ниже)
  root: "scripts/social_feed"                 // если папку переименовали
})
```

Можно держать несколько блоков с разными `view`/`id` на одной странице, например отдельная заметка «Бенто» с `nav: false`.

## Экраны

| view | Что это | Из макетов |
|---|---|---|
| `overview` | Пульс месяца (заметки, стрик, связи, медиа), матрица активности за год (клик по дню → поток), трендовые теги, случайные озарения с 🎲, плитки-переходы | Overview & Pulse |
| `stream` | Лента карточек: быстрые режимы (Все / В этот день / Рандомные 🎲 / Избранное), формула фильтра, конструктор тегов ANY/ALL/NOT, атрибуты, раскладки Masonry / Flow / Timeline | Flow Stream |
| `bento` | Та же лента в асимметричной сетке: видео и canvas 2×1, фото 1×2, цитаты и аудио с цветным фоном | Bento Grid |
| `collections` | Галерея смарт-подборок из `data/presets.json`: правила, счётчик, мини-превью rich-ссылками, «Открыть как поток / Бенто», 🎲 для случайных | Smart Collections |
| `studio` | Конструктор: название/иконка/режим, теги, атрибуты, период, порог бэклинков, сортировка, источники; справа — живой отклик (число и время) и готовый **DQL** с копированием; «Сохранить» пишет подборку в `data/presets.json` | Query Studio / Tag Builder |

## Типы карточек

Тип определяется автоматически (приоритет сверху вниз), либо явно через frontmatter `type: audio|video|image|quote|tasks|link|canvas|text`.

| Тип | Условие | Тело карточки |
|---|---|---|
| video | в заметке встроено видео (`![[x.mp4]]`) | плеер + текст |
| audio | встроено аудио (`![[x.m4a]]`) | плеер с «волной» и прогрессом + текст |
| canvas | встроен `.canvas` | плитка «Открыть в Canvas» + текст |
| image | встроены изображения | сетка до 4 фото, «+N» |
| quote | тег из `quoteTags` (`#цитата`…) или цитаты занимают > 40% текста | крупная цитата (`> [!quote] Автор`) + остальной текст |
| tasks | ≥ 2 задач `- [ ]` | прогресс-бар + первые 6 задач |
| link | внешний URL и < 45 слов | превью ссылки (домен/адрес) |
| text | всё остальное | markdown-превью с «Читать далее» |

Вики-ссылки `[[…]]` внутри текста стилизуются как в `DESIGN.md` (моно-шрифт, фиолетовая плашка). В подборках и живом отклике заметки показываются как **rich-link** с иконкой типа, датой и числом связей.

Дата карточки берётся из первого найденного поля `dateFields` (frontmatter), иначе из имени файла (`YYYY-MM-DD`), иначе из даты создания файла.

## Формат фильтра

```json
{ "any": ["мысли", "zettel"], "all": [], "not": ["архив"],
  "attrs": ["media", "task"], "types": ["audio"], "sources": ["lj"],
  "period": "30d", "day": "2026-05-14", "minBacklinks": 3, "text": "", "sort": "date-desc" }
```

* `any` — хотя бы один тег (OR); `all` — все теги (AND); `not` — ни одного (NOT). Группы соединяются через AND. Тег `a` совпадает и с `a/b`.
* `attrs`: `media photo video audio quote task link`. `period`: `all 7d 14d 30d 3m 1y`.
* `sort`: `date-desc date-asc mtime-desc backlinks-desc length-desc alpha-asc`.
* Быстрый режим (`quick`): `all | today | random | favorites`, применяется после фильтра; `random` берёт `randomCount` записей, «Перемешать» меняет только seed.

## Данные — `data/`

| Файл | Назначение | Правится руками? |
|---|---|---|
| `config.json` | источники, поля дат, теги цитат/избранного, тема, размер страницы и т.д. | да |
| `presets.json` | смарт-подборки (создаются в студии или вручную) | да |
| `flags.json` | избранное и закрепы (путь → флаги) | нет |
| `state.json` | последнее состояние экранов по `id` (фильтр, режим, раскладка) | нет |

Файлы **заметок никогда не изменяются**: избранное и закрепы живут в `flags.json`. Заметка также считается избранной, если у неё `favorite: true` или тег из `favoriteTags`.

### Основные опции `config.json`

| Ключ | По умолчанию | Описание |
|---|---|---|
| `sources` | `notes` | `[{id, label, folder, enabled}]`; пустой `folder` = весь vault |
| `excludeFolders` / `excludeTags` | `scripts`, `.obsidian`, `templates` / — | что не показывать |
| `dateFields` | `date, Date, created, дата, Дата` | поля frontmatter с датой (по порядку) |
| `quoteTags`, `favoriteTags`, `favoriteField` | `цитата…`, `избранное…`, `favorite` | как распознавать цитаты и избранное |
| `fullWidth` | `false` | растянуть блок и заметку на всю ширину; то же — параметр `fullWidth: true` в `dv.view`, кнопка ⤢ в навигации (запоминается) или `cssclasses: sf-page-full` |
| `theme` / `nav` / `defaultView` / `layout` | `auto` / `true` / `stream` / `masonry` | оформление и стартовые экраны |
| `pageSize`, `excerptChars`, `randomCount`, `insightsCount`, `topTags` | 24, 420, 12, 3, 24 | размеры выборок |
| `concurrency` | 8 | сколько заметок читать параллельно |
| `deepScan` | false | прочитать тела **всех** заметок в фоне: точные типы/цитаты и поиск по тексту (медленнее на больших vault) |
| `dql.dateExpr` | `file.cday` | какое выражение даты подставлять в DQL (например `date`) |

> Без `deepScan` тип карточки и атрибуты «цитаты/ссылки» определяются по тегам/вложениям (из метаданных Dataview), а точно — после чтения тела при отрисовке карточки. Фильтр по типу и «цитатам» поэтому может не видеть ещё не показанные заметки; включите `deepScan`, если нужна точность.

## CSS — `css/`

Файлы подключаются одним `<style>` по алфавиту имён:

| Файл | Содержимое |
|---|---|
| `00-tokens.css` | **все** цвета, радиусы, шрифты (светлая тема + тёмная; токены из `DESIGN.md`) |
| `10-base.css` | корень, кнопки, чипы, поля ввода, пустые состояния |
| `15-fullwidth.css` | режим «на всю ширину» (`.is-full`, `.sf-page-full`) |
| `20-shell.css` | навигация, тулбар, крошки, сегменты раскладок |
| `30-filters.css` | быстрые режимы, панель фильтров, формула, тег-билдер |
| `40-card.css` / `41-card-types.css` | карточка и тела по типам, rich-link |
| `50-feed.css` | masonry, flow, timeline, bento |
| `60-overview.css`, `70-collections.css`, `80-studio.css` | соответствующие экраны |
| `85-responsive.css` | desktop ≥1280 · tablet 768–1279 · mobile <768 |
| `90-custom.css` | **ваши** переопределения (подключается последним) |

Тема `auto` следует теме Obsidian; `theme: "dark" | "light"` фиксирует её. Шрифты Geist / Inter / JetBrains Mono используются, если установлены в системе, иначе — шрифты Obsidian.
Классы начинаются с `sf-` и не затрагивают остальной интерфейс.

## Структура

```
scripts/social_feed/
├─ view.js                 точка входа dv.view(...): bootstrap, показ ошибок
├─ core/loader.js          CommonJS-загрузчик: читает все *.js из папки и даёт require("app/main")
├─ app/                    композиция приложения
│  ├─ main.js              конфиг → CSS → сервисы → контекст → оболочка
│  ├─ shell.js             корень, тема, переключение экранов, toast
│  ├─ state.js             реактивный стор + сохранение в data/state.json
│  ├─ actions.js           ВСЕ изменения состояния (UI вызывает только их)
│  └─ open-note.js         открытие заметки (Ctrl/Cmd — новая вкладка)
├─ lib/                    чистые утилиты: dom, icons, date, ru, text, random, store, async, misc
├─ model/                  post.js (страница → пост), analyzer.js (разбор тела), media-kinds.js
├─ types/                  реестр типов карточек: video audio canvas image quote tasks link text
├─ filters/                state, predicates, engine, sorters, periods, attrs, quick-modes,
│                          pipeline, formula, dql, presets
├─ stats/                  activity (heatmap, стрик), period (пульс месяца), tags
├─ services/               config, storage, css-loader, md, media, content, flags, presets, posts
├─ ui/
│  ├─ common/              chip, icon-button, segmented, select, empty, nav, rich-link, toast
│  ├─ card/                card, header, footer, bodies/{text,quote,audio,video,image,canvas,tasks,link}
│  ├─ feed/                feed, layouts, groups, load-more, toolbar
│  ├─ filters/             quickbar, formula-bar, tag-builder, attr-toggles, advanced, filter-panel
│  ├─ overview/            stat-card, pulse, heatmap, trending, insights, tiles
│  ├─ collections/         preset-card
│  └─ studio/              meta-panel, dql-panel, dql-highlight, live-preview
├─ views/                  overview, stream, bento, collections, studio, feed-view (фабрика), index
├─ css/                    см. таблицу выше
├─ data/                   config.json, presets.json, flags.json, state.json
└─ tests/                  run.js, fake-dom.js, fixtures.js (в Obsidian не загружаются)
```

Правила слоёв: `lib`, `model`, `types`, `filters`, `stats` — чистые функции без DOM и Obsidian API (тестируются в Node); `services` — доступ к vault/Dataview/файлам; `ui` — только отрисовка и вызов `ctx.actions`; `views` — сборка экранов из `ui`.
Модуль подключается как `require("lib/dom")` (путь от корня папки) или относительно; `index.js` в папке можно импортировать по имени папки (`require("types")`). Новые `.js` файлы подхватываются автоматически — список модулей нигде не ведётся.

## Как расширять

* **Новый тип карточки**: добавьте `types/<id>.js` (`{id, label, icon, match(post, feats)}`), включите его в список в `types/index.js` (порядок = приоритет), добавьте `ui/card/bodies/<id>.js` с `render(ctx, post, feats, el)` и перечислите в `ui/card/bodies/index.js`; стили — в `css/41-card-types.css`.
* **Новый экран**: `views/<id>.js` → `{id, title, icon, render(ctx, el)}` (можно вернуть функцию-деструктор), добавьте в `views/index.js`.
* **Новое условие фильтра**: функция в `filters/predicates.js`, поле в `filters/state.js` (`defaultFilter`), при необходимости — в `formula.js` и `dql.js`.
* **Своё оформление**: `css/90-custom.css` или переменные `--sf-*` из `00-tokens.css`.

## Тесты

```bash
node scripts/social_feed/tests/run.js
```

Прогоняет юнит-тесты чистых модулей и дымовой тест всех экранов на заглушке DOM с фиктивным vault (копия папки во временном каталоге; ваши `data/*` не затрагиваются). Тесты **не заменяют** проверку в самом Obsidian.

## Ограничения и диагностика

* Тест на реальном Obsidian/Dataview не выполнялся. Наиболее чувствительное место — рендер markdown (`services/md.js`): используется `MarkdownRenderer` Obsidian, а если он недоступен из dataviewjs — запасной путь через `dv.paragraph` с подменой контейнера; в крайнем случае показывается сырой текст. Если в карточках виден сырой markdown — откройте консоль (Ctrl+Shift+I) и найдите `[social_feed] markdown fallback`.
* Любая ошибка запуска показывается красным блоком в самой заметке, подробности — в консоли.
* Режим Live Preview/Reading: dataviewjs-блоки надёжнее всего работают в режиме чтения.
* Медиа ищутся через `metadataCache` (по имени файла, как вики-ссылки); если файла нет — карточка покажет «файл не найден».
* Не реализовано из макетов: Canvas View как раскладка ленты, быстрый захват мысли (⌥N), 3D-граф, пакетная AI-транскрибация — это за пределами Dataview.
* Изменили код или CSS — просто обновите заметку (кнопка ⟳ в тулбаре перечитывает vault). Модули читаются заново при каждом открытии блока.
