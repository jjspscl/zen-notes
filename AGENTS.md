# Zen Notes Widget — Agent Guide

> Quick reference for building and maintaining this Zen Browser mod.

## Project Context

Zen Browser mod that injects a persistent, collapsible block-based notes widget into the sidebar with a single note instance.

- **Mechanism**: Sine-loaded mod with `theme.json`-driven script injection (5 modules with `loadOrder`) and one chrome CSS sheet
- **Development**: `npm test` for unit and migration tests; `npm run zen` opens a live-reloading XHTML harness in Zen using a disposable profile. Test real persistence by installing a beta branch through Sine; never manually copy files into a Zen profile.
- **Storage**: schema v5 JSON file at `<profile>/zen-notes/notes.json`, atomically written through `IOUtils`; legacy `zen.notes.data` preference mirror is kept for 2.4.x rollback
- **Target Browser**: Zen Browser v1.7x+
- **Current Version**: v2.5.0-beta.1
- **License**: MIT

## Quick Links

- [GitHub Repository](https://github.com/jjspscl/zen-notes)
- [GitHub Releases](https://github.com/jjspscl/zen-notes/releases)
- [CHANGELOG.md](./CHANGELOG.md) — version history
- [ROADMAP.md](./ROADMAP.md) — milestones and status
- [CONTRIBUTING.md](./CONTRIBUTING.md) — development guide
- [install.md](./install.md) — end-user installation guide

## Build Steps

### Local Development (WSL / Windows Zen)

```bash
npm ci
npm test
npm run zen       # starts Windows Zen with a disposable profile and local XHTML harness
npm run harness   # opens the same harness in the default browser
npm run zen:test  # runs automated tests, then opens the harness
```

The local harness stubs profile file storage; use a Sine-installed beta in a separate test profile to verify real `IOUtils` persistence, restart behavior, and multi-window syncing. Do not copy files into a Zen profile: Sine owns its installed mod directory. Set `ZEN_PATH` if Zen is installed outside the default Windows path.

### Release Build

```bash
# Bump version
node scripts/bump.js patch   # or minor/major/explicit version

# Validate
node scripts/validate-version.js
node scripts/validate-theme.js
node scripts/validate-header.js
node scripts/validate-css.js
npm test
node --check zen-notes-core.uc.js && node --check zen-notes-model.uc.js && node --check zen-notes-store.uc.js && node --check zen-notes-editor.uc.js && node --check zen-notes-ui.uc.js

# Commit & tag
git add -A && git commit -m "chore: bump version to vX.Y.Z"
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Validation Scripts

| Script | Purpose |
|--------|---------|
| `scripts/validate-version.js` | Cross-file version sync (`theme.json`, `mod.json`, JS header/runtime, README, ROADMAP) |
| `scripts/validate-theme.js` | Sine `theme.json` contract validation |
| `scripts/validate-header.js` | UserScript block validation (required fields) |
| `scripts/validate-css.js` | CSS syntax check (brace balance, block depth) |
| `scripts/build-release.js` | Assembles namespaced release ZIP |
| `scripts/bump.js` | Automated version bump across all files |

## Test Checklist

- [ ] Widget visible in sidebar (bottom, above workspace indicators)
- [ ] Text persists after browser restart
- [ ] Collapse/expand toggle works
- [ ] Collapsed state shows full header with chevron
- [ ] Dark mode matches Zen theme
- [ ] Light mode matches Zen theme
- [ ] Widget does not block sidebar scrolling or tab interaction
- [ ] Workspace switching still works
- [ ] Compact sidebar mode handles widget gracefully
- [ ] Long text wraps inside editor without expanding sidebar width
- [ ] Drag-to-resize works and height persists
- [ ] Bold/italic formatting via toolbar and keyboard shortcuts
- [ ] Bullet/numbered list formatting persists correctly
- [ ] List deletion: bullet/number button removes list; Backspace at start of first item exits list
- [ ] Checklist deletion: checklist button clears checkboxes and strikethrough; Backspace at first item exits
- [ ] Tab/Shift+Tab nests and unnests in both `ul` and `ol`; never produces `blockquote`
- [ ] Ctrl+Z reverts list ops, indent/outdent, and markdown conversions in single steps
- [ ] Markdown input rules: `- `, `* `, `1. `, `[] ` convert at line start only
- [ ] Word/character count updates live and is hidden on empty notes
- [ ] `data-checklist="true"` persists on save/reload; old `class="zen-notes-checklist"` migrates on load
- [ ] Caret does not jump to editor end after formatting
- [ ] Color picker changes default color and persists
- [ ] Read-only and save-conflict states display a clear recovery path
- [ ] Single note survives browser restart without data loss
- [ ] Auto-save interval flushes on crash (test with forced shutdown)
- [ ] Browser console shows no errors or warnings
- [ ] Block types: headings, quote, callout, divider, toggle, and code persist/reload
- [ ] Nested bullet, numbered, and to-do children persist with indent and checked state
- [ ] Ctrl+Z / Ctrl+Shift+Z undo and redo formatting and structure; typing groups into one step
- [ ] `/` menu and markdown shortcuts select/convert all supported block types
- [ ] Alt+Shift+Up/Down moves blocks with descendants
- [ ] Keyboard shortcuts do nothing with focus outside the notes widget; Escape outside does not collapse it
- [ ] Large note file saves atomically; file write failure shows error and retains in-memory edits
- [ ] Newer schema opens read-only; 2.4.x pref mirror remains readable
- [ ] Two Zen windows sync saves without overwriting pending local edits

## Coding Conventions

### JavaScript (`*.uc.js`)
- **Never compare `Element.tagName` against uppercase literals.** The chrome document is `application/xhtml+xml`, where `tagName` is lowercase (`"ul"`), unlike HTML documents where it is uppercased (`"UL"`). Use `localName` (lowercase in both) or the `isTag`/`isListTag` helpers. This caused the list/checkbox failures in v2.3.0–v2.3.2, and it cannot be caught by tests running in an HTML page.
- Preference prefix: `zen.notes.*`
- Use `IOUtils.writeJSON` with a `tmpPath` for atomic writes to `<profile>/zen-notes/notes.json`. Keep a v4 HTML copy in `zen.notes.data` after saves for rollback compatibility. Fall back to pref-only storage when IOUtils is unavailable.
- Wait for DOM ready before injection (`gBrowserInitialized` or `DOMContentLoaded`)
- Clean up event listeners on window unload (named references required)
- No runtime dependencies — Zen chrome APIs only; Node test dependencies are dev-only and never ship
- Extract magic numbers to named constants with comments
- Wrap init in try/catch error boundary
- All global listeners must be removable in cleanup

### CSS (`style.css`)
- Theme matching uses custom property tokens (`--zen-notes-bg`, `--zen-notes-text`, `--zen-notes-border`, `--zen-notes-surface-strong`) resolved through `data-color-mode` (adapt/preset/classic). Adapt mode chains over `--zen-*`, `--nebula-*`, and `--natsumi-*` vars. Presets are hardcoded hex blocks.
- No inline styles — all widget styling in this file
- Sidebar-safe: `flex-shrink: 0`, avoid `position: absolute` inside sidebar
- Prefix all selectors with `#zen-notes-widget` to avoid collisions
- Test CSS changes individually in browser before committing — full CSS changes can silently break rendering

### File Naming
- JS: `*.uc.js` (loaded by Sine from `theme.json` scripts map with `loadOrder`)
- CSS: `style.css`
- Prefs: `preferences.json`

## Architecture Notes

### DOM Injection Point
Insert widget `vbox` before `#zen-sidebar-foot-buttons` as a child of `#TabsToolbar`.
This places the widget between the tab list and the bottom toolbar (workspace indicators, expand button, new tab button).

**Old (broken) approach:** Inserting before `#zen-workspaces-button` inside `#zen-sidebar-foot-buttons` placed the widget at the very bottom, mixed in with the workspace indicators.

**Correct approach:** `tabsToolbar.insertBefore(widget, footButtons)` where:
- `tabsToolbar` = `document.getElementById("TabsToolbar")`
- `footButtons` = `document.getElementById("zen-sidebar-foot-buttons")`

### Storage Model (schema v5)
- **Single note**: `state.note` stores metadata and a flat `blocks[]` list. Nesting is an `indent` value (0–5), not nested HTML.
- **Primary file**: `<profile>/zen-notes/notes.json`, written through `IOUtils.writeJSON` with a temporary path and dated backups. Sine does not manage this directory.
- **Compatibility mirror**: successful saves also write schema-v4 HTML to `zen.notes.data` for stable 2.4.x rollback. If IOUtils is unavailable, full schema-v5 state uses `zen.notes.dataV5Fallback` (subject to the preference size cap).
- **Migration**: old note HTML, lists, checklist flags, formatting and nested lists are converted to blocks. Preserve source data in a legacy backup before migration.
- **Newer schemas**: do not reset data; open read-only and display a notice.
- **Cross-window**: writes use a profile lock and revision check, then broadcast a revision. A stale writer cannot overwrite a newer disk revision; preserve conflicted local state in a recovery backup.

### Storage Limits
The compatibility pref mirror is capped near 1 MiB. The JSON file is the source of truth and supports larger notes; if the mirror cannot be updated, log/show that rollback compatibility is unavailable without failing the primary save.

### Compatibility Risks
- Zen sidebar DOM changes between versions may break injection selector
- Other sidebar mods may conflict if they manipulate the same parent node
- XHTML chrome DOM differs from regular HTML; test node/tag behavior in the XHTML harness and real Zen

## Distribution

### Release ZIP Structure
```
zen-notes-2.5.0-beta.1.zip
└── zen-notes/
    ├── zen-notes-core.uc.js
    ├── zen-notes-model.uc.js
    ├── zen-notes-store.uc.js
    ├── zen-notes-editor.uc.js
    ├── zen-notes-ui.uc.js
    ├── style.css
    ├── preferences.json
    ├── theme.json
    ├── mod.json
    ├── README.md
    └── install.md
```

### GitHub Actions CI/CD
- **CI** (`.github/workflows/ci.yml`): validates on every push/PR
- **Release** (`.github/workflows/release.yml`): builds ZIP + creates GitHub Release on `v*` tag push

### Sine / Store
- Root `theme.json` is now part of the release contract.
- Store publication should target Sine (`sineorg/store`), not the legacy Zen Mod Store.
- Stable marketplace installs should track `main`.
- Beta tester installs should track `beta` and replace stable in the same profile; no side-by-side beta/stable support unless prefs and DOM IDs are namespaced later.

### Release Channels
- **Stable**: `main`, normal SemVer (`vX.Y.Z`), official GitHub releases, Sine marketplace users.
- **Beta**: `beta`, prerelease SemVer (`vX.Y.Z-beta.N`), GitHub prereleases, tester/custom installs.
- Beta builds use the same mod ID (`zen-notes`) and `zen.notes.*` prefs as stable.
- Any beta storage schema bump must include migration notes, rollback risk notes, and validation steps.

## Release Process

1. Choose channel: stable from `main` (`vX.Y.Z`) or beta from `beta` (`vX.Y.Z-beta.N`)
2. Run `node scripts/bump.js <patch|minor|major|version>`
3. Validate: `node scripts/validate-version.js && node scripts/validate-theme.js && node scripts/validate-header.js && node scripts/validate-css.js && node --check zen-notes-core.uc.js && node --check zen-notes-editor.uc.js && node --check zen-notes-ui.uc.js`
4. Update `ROADMAP.md` status if needed
5. Commit: `git add -A && git commit -m "chore: release vX.Y.Z"`
6. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
7. CI auto-creates GitHub Release with ZIP
8. Users receive the update through Sine on browser start

## Troubleshooting

### Widget doesn't appear after restart
1. Confirm Sine is installed and the mod is enabled in Sine settings
2. Confirm the edited files actually reached `<profile>/chrome/sine-mods/zen-notes/`
3. Open Browser Console (`Ctrl+Shift+J`) for `[ZenNotes]` messages
4. Clear startup cache (`about:support`)
5. Verify `theme.json` is at the mod root and references the correct files

### DOM changes break widget
- Check `#TabsToolbar` and `#zen-sidebar-foot-buttons` still exist in Zen DOM
- Update selectors in `zen-notes-ui.uc.js` if Zen changed IDs

### CSS changes silently break widget
- Test CSS changes individually — do not batch large CSS refactors without browser testing
- `mask-image`, `:root` vars, `@media` blocks all need validation in Zen context
- CSS in userChrome context can behave differently than in content pages — test every change in-browser
