# Architecture

Zen Notes is a Sine mod: plain browser-chrome JavaScript and CSS, no runtime dependencies, no bundler.

## Repository layout

```
src/                     everything Sine loads
  zen-notes-core.uc.js     constants, pref helpers, small utilities        (loadOrder 10)
  zen-notes-model.uc.js    block model + pure operations + HTML conversion (loadOrder 15)
  zen-notes-store.uc.js    file storage, migration, backups, locking, sync (loadOrder 18)
  zen-notes-editor.uc.js   contenteditable block editor                   (loadOrder 20)
  zen-notes-ui.uc.js       widget shell, header, toolbar, status, resize   (loadOrder 30)
  style.css                all styling, nested under #zen-notes-widget
theme.json               Sine manifest (id, version, updatedAt, homepage, scripts, style)
mod.json                 legacy metadata (kept in sync by scripts/bump.js)
preferences.json         Sine settings UI schema
test/                    node:test suites (run against the real source files)
dev/harness.xhtml        local XHTML harness with stubbed prefs/IOUtils
scripts/                 validate, bump, build-release, launch-zen
docs/                    this documentation
```

## Module contract

Scripts are classic `.uc.js` files executed in the browser window global by Sine, in `loadOrder`. They share one namespace, `window.ZenNotes`: each module reads what earlier modules exported and adds its own exports with `Object.assign(window.ZenNotes, {...})`. Each file is an IIFE with `"use strict"`.

| Module | Reads | Exports |
|---|---|---|
| core | Services, document | prefs helpers, `PRESETS`, `resolvePreset`, ids, formatting, `createNote` |
| model | core | `createBlock`, block operations, `htmlToBlocks`, `blocksToHTML` |
| store | core, model | `storeLoad`, `storeSave`, `storeBackup`, `storeSubscribe` |
| editor | core, model | `createBlockEditor(editorEl, blocks, { onChange })` |
| ui | all | builds `#zen-notes-widget`; no exports |

## Runtime flow

1. Sine loads the five scripts when a browser window opens. `ui` waits for idle time (`requestIdleCallback`, 1.5 s cap), then inserts the widget before `#zen-sidebar-foot-buttons` in `#TabsToolbar`.
2. `ui` calls `storeLoad()` (async). When it resolves the editor is created over `state.note.blocks`.
3. Editor edits mutate an immutable `blocks[]`; `onChange` marks the note dirty. `ui` debounces (350 ms) and calls `storeSave()`; a 5 s interval flushes stragglers.
4. `storeSave` writes under a profile lock with a revision check, then notifies other windows through `Services.obs` (`zen-notes-data-changed`).

## Sine contract (do not break)

- Scripts and the stylesheet are referenced from `theme.json`; nested folders are allowed (`"scripts": {"src": {...}}`).
- Sine only offers an update when `theme.json.updatedAt` is newer than the installed copy, and it re-reads `theme.json` from the branch named in `homepage`. `scripts/bump.js` maintains both.
- `supportsUnload: true`: the UI registers cleanup with `window.addUnloadListener`.
- Do not use `@layer` in `style.css`: Zen's own unlayered chrome CSS would always win.
- In the chrome XHTML document `Element.tagName` is lowercase; use `localName`.

## Performance notes

- Widget construction is deferred to idle time; the slash menu is created on first use.
- `render()` in the editor reuses DOM rows for blocks whose object identity did not change, so typing or structural edits touch only the affected rows.
- CSS uses native nesting, custom properties, `color-mix()` and `light-dark()`; palettes only define five tokens.
