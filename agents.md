# AGENTS.md — Meow Squad

## Обзор

Статический браузерный survivors-like без зависимостей и сборки. `netlify.toml` публикует корень репозитория (`publish = "."`). Не добавляйте бандлеры и npm-пакеты без явной просьбы.

## Файлы

- `index.html` — разметка: canvas, HUD, **лобби** (`#menu.lobby`), модалка лобби (`#lbModal`), тост (`#lbToast`), экраны Level Up / Pause / Game Over (`#overRewards` — блок наград). `lobby.js` подключается **до** `game.js`.
- `style.css` — стили игры, HUD, карточек улучшений и экранов. Палитра в `:root` (`--gold`, `--orange`, `--violet`, `--cyan`, `--red`, `--muted`).
- `lobby.css` — стили лобби (префикс классов `lb-`), использует ту же палитру.
- `game.js` — вся игра (константы, `CAT_TYPES`, атаки, spatial grid, спавн, рендер, цикл).
- `lobby.js` — мета-прогрессия и UI лобби, глобальный объект `window.MeowLobby`.

## Связь игры и лобби

`game.js` экспортирует мост `window.MeowSquad`: `CAT_TYPES`, `ITEMS`, `catPortrait(def, lvl, size)`, `fmtTime`, `sfx`, `startRun()`, `leader`, `setLeader(id)`.

`game.js` вызывает `MeowLobby`:
- `init(bridge)` — в конце загрузки;
- `runBoost()` — в `newGame()`. Возвращает `{ hp, dmg, armor, speed, magnet, enemyHp, cat: {id: mult} }`, который сохраняется в `G.boost`. Множители применяются в `catStat` (урон), `spawnEnemy` (HP врагов), `hurtHero` (броня) и к параметрам героя;
- `requestRun()` — кнопка «Ещё забег» и Enter в меню (списывает энергию, затем `startRun`);
- `onRunEnd(result)` — из `endRun`, начисляет награды и заполняет `#overRewards`;
- `onMenu()` — из `toMenu`.

Без `lobby.js` игра работает с нейтральными множителями.

## Данные

- `localStorage['meowsquad-profile']` — профиль (v1): валюты, энергия с `energyAt`, главы (`unlocked`, `best`, `chests`), уровни котов, таланты, daily, quests, stats.
- `meowsquad-leader`, `meowsquad-mute`, `meowsquad-best` — ключи самой игры.
- Тюнинг экономики — константы в начале `lobby.js` (`CHAPTERS`, `MILES`, `TALENTS`, `DAILY`, `QUESTS`, `ENERGY_*`, `RUN_COST`).

## Соглашения

- Интерфейс на русском языке.
- Пользовательский текст (имя игрока) экранируется через `esc()` или выводится через `textContent`.
- Скролл-контейнеры лобби требуют `touch-action: pan-y`, потому что у `body` стоит `touch-action: none`.
