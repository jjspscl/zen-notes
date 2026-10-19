# Zen Notes — Agent Guide

Sticky-note block editor widget for Zen Browser, shipped as a [Sine](https://github.com/CosmoCreeper/Sine) mod. Plain chrome JavaScript + CSS, no runtime dependencies. Current: see `theme.json`.

Read [docs/architecture.md](docs/architecture.md) first; the rest of `docs/` is reference. `llms.txt` indexes it.

## Commands

```bash
npm ci
npm run check     # biome (lint+format) + scripts/validate.js + node --test  — must pass
npm run fmt       # biome format --write
npm run zen       # live-reload harness in a disposable Zen profile (WSL → Windows Zen)
npm run build     # release zip (needs `zip`)
node scripts/bump.js <patch|minor|major|x.y.z[-beta.N]>
```

## Layout

`src/` runtime (5 `.uc.js` + `style.css`) · `test/` · `dev/harness.xhtml` · `scripts/` · `docs/` · root: `theme.json` (Sine manifest), `mod.json`, `preferences.json`.

## Hard rules

1. **Never copy files into a Zen profile.** Sine owns `<profile>/chrome/sine-mods/`. Install/update via Sine only (beta source: `https://github.com/jjspscl/zen-notes/tree/beta`).
2. **Releases go through `scripts/bump.js`.** It refreshes `theme.json` `updatedAt` (Sine only updates if newer) and `homepage` (`/tree/beta` for `-beta.N`, plain URL for stable). `npm run validate` enforces it.
3. **Chrome DOM is XHTML:** compare `Element.localName`, never uppercase `tagName`.
4. **No `execCommand`.** Edits are model operations; see [docs/editor.md](docs/editor.md). Preserve IME and the arrow-key guard.
5. **Shortcuts are scoped** to the editor/widget, never `document`.
6. **CSS:** everything nested under `#zen-notes-widget` in `src/style.css`; palettes set only the five `--zn-*` colour tokens; **no `@layer`** (Zen's unlayered CSS would win); no inline styles.
7. **Storage:** `notes.json` schema v5 written atomically; newer schemas open read-only; never reset user data. The v4 pref mirror is deprecated (remove in 2.6). See [docs/storage.md](docs/storage.md).
8. **No runtime dependencies.** `linkedom` and `@biomejs/biome` are dev-only.
9. Test CSS/JS changes in the harness and real Zen; Node tests run the real source in a `vm` and cannot catch XHTML/Firefox behaviour.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Add a test for behaviour changes (`test/*.test.js`, `node:test` + `linkedom`).
- Update `CHANGELOG.md` for user-visible changes; keep docs in `docs/` current (architecture changes → `docs/architecture.md` or a new ADR in `docs/decisions/`).
- Biome formatting is authoritative (2 spaces, double quotes, width 120).

## Manual verification checklist (real Zen via Sine)

- Widget at sidebar bottom; collapse/expand; drag-resize persists
- Sticky default (light/dark), other palettes, Appearance setting
- Toolbar only while focused; overflow "⋯" at narrow widths
- Placeholders hide on focus, return on blur when empty
- Ctrl+A then type / Enter / Backspace / paste keeps block structure
- Block types, nested lists, Tab/Shift+Tab, Alt+Shift+Up/Down, undo/redo
- Restart persistence; 2.4.x → 2.5 migration; two windows sync; newer schema read-only
- Browser Console shows no `[ZenNotes]` errors
