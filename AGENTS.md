# Zen Notes Widget — Agent Guide

> Quick reference for building and maintaining this Zen Browser mod.

## Project Context

Zen Browser mod that injects a persistent, collapsible notes widget into the sidebar, with a global notes library and per-workspace pinned note state.

- **Mechanism**: `userChrome.js` + `userChrome.css` with Sine-first repo metadata
- **Loader Required for local beta testing**: `fx-autoconfig` (or compatible `userChrome.js` loader)
- **Storage**: versioned `Services.prefs` JSON store (`zen.notes.data`) — schema v3 (global `notes[]` + per-workspace `workspaceState`); legacy v1/v2 prefs preserved for migration
- **Target Browser**: Zen Browser v1.7x+
- **Current Version**: v2.0.0-beta
- **License**: MIT

## Quick Links

- [GitHub Repository](https://github.com/jjspscl/zen-notes)
- [GitHub Releases](https://github.com/jjspscl/zen-notes/releases)
- [CHANGELOG.md](./CHANGELOG.md) — version history
- [ROADMAP.md](./ROADMAP.md) — milestones and status
- [CONTRIBUTING.md](./CONTRIBUTING.md) — development guide
- [install.md](./install.md) — end-user installation guide

## Build Steps

### Local Development (WSL)

1. Edit `notes-widget.uc.js` or `style.css` in project directory
2. Copy to Zen Browser profile:
   ```bash
   cp notes-widget.uc.js "/mnt/c/Users/jpascual/AppData/Roaming/zen/Profiles/y22xqyfw.Default (release)/chrome/JS/"
   cp style.css "/mnt/c/Users/jpascual/AppData/Roaming/zen/Profiles/y22xqyfw.Default (release)/chrome/userChrome.css"
   cp style.css "/mnt/c/Users/jpascual/AppData/Roaming/zen/Profiles/y22xqyfw.Default (release)/chrome/CSS/zen-notes.uc.css"
   ```
3. Clear startup cache (via `about:support` or delete `startupCache/` folder)
4. Restart Zen Browser
5. Verify widget appears between tabs and workspace indicators
6. Test collapse/expand, text persistence, theme matching, text wrapping

### Release Build

```bash
# Bump version
node scripts/bump.js patch   # or minor/major/explicit version

# Validate
node scripts/validate-version.js
node scripts/validate-theme.js
node scripts/validate-header.js
node scripts/validate-css.js
node --check notes-widget.uc.js

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
- [ ] Color picker changes card color and persists
- [ ] Workspace-specific note sets switch correctly
- [ ] Quick new creates and pins a new active note
- [ ] Manager screen can rename, reorder, and hard-delete notes
- [ ] Auto-save interval flushes on crash (test with forced shutdown)
- [ ] Browser console shows no errors or warnings

## Coding Conventions

### JavaScript (`*.uc.js`)
- Preference prefix: `zen.notes.*`
- Use `Services.prefs` for storage, not file I/O
- Wait for DOM ready before injection (`gBrowserInitialized` or `DOMContentLoaded`)
- Clean up event listeners on window unload (named references required)
- No external dependencies — Zen chrome APIs only
- Extract magic numbers to named constants with comments
- Wrap init in try/catch error boundary
- All global listeners must be removable in cleanup

### CSS (`style.css`)
- Theme matching: `light-dark(black, white)` and `--zen-colors-*` vars
- No inline styles — all widget styling in this file
- Sidebar-safe: `flex-shrink: 0`, avoid `position: absolute` inside sidebar
- Prefix all selectors with `#zen-notes-widget` to avoid collisions
- Test CSS changes individually in browser before committing — full CSS changes can silently break rendering

### File Naming
- JS: `*.uc.js` (required by `fx-autoconfig` loader)
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

### Storage Model (schema v3)
- **Global notes library**: Single `state.notes[]` array shared across all workspaces.
- **Per-workspace pinned state**: `state.workspaceState[workspaceId].pinnedActiveNoteId` stores which global note is active for that workspace.
- **Migration Path**: v1 (single note prefs) → v3 (global notes). v2 (per-workspace note sets) → v3 detected and flattened with ID collision resolution.
- **Delete reparation**: Removing a note repairs all workspace pinned refs that pointed at it, redirecting them to the first remaining global note.

### Title Trigger + Popover
- Header shows a button (`.zen-notes-title-trigger`) with current pinned note title + chevron.
- Click opens an anchored popover (`.zen-notes-popover`) with the full note list.
- Popover keyboard: Arrow Up/Down, Enter/Space to select, Home/End, Escape to close.
- Focus management: selected row auto-focused on open; trigger re-focused on close.

### Storage Limits
`Services.prefs` string prefs have a soft limit around 1MB. This is still workable for a small global note library, but larger future features (search/export/history) should watch payload growth.

### Compatibility Risks
- Zen sidebar DOM changes between versions may break injection selector
- Other sidebar mods may conflict if they manipulate the same parent node
- `DOMParser` for HTML sanitization strips XUL namespace info and breaks widget rendering in chrome context

## Distribution

### Release ZIP Structure (Namespaced)
```
zen-notes-1.0.0.zip
├── zen-notes/
│   ├── chrome/
│   │   ├── JS/
│   │   │   └── notes-widget.uc.js
│   │   └── preferences.json
│   ├── userChrome.css
│   ├── mod.json
│   └── install.md
└── README.md
```

### GitHub Actions CI/CD
- **CI** (`.github/workflows/ci.yml`): validates on every push/PR
- **Release** (`.github/workflows/release.yml`): builds ZIP + creates GitHub Release on `v*` tag push

### Sine / Store
- Root `theme.json` is now part of the release contract.
- Store publication should target Sine (`sineorg/store`), not the legacy Zen Mod Store.
- Final v2 release remains blocked on validating Zen workspace runtime identity and switching contracts.

## Release Process

1. Run `node scripts/bump.js <patch|minor|major|version>`
2. Validate: `node scripts/validate-version.js && node scripts/validate-theme.js && node scripts/validate-header.js && node scripts/validate-css.js && node --check notes-widget.uc.js`
3. Update `ROADMAP.md` status if needed
4. Commit: `git add -A && git commit -m "chore: release vX.Y.Z"`
5. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
6. CI auto-creates GitHub Release with ZIP
7. Update local build if testing: copy files to Zen profile, clear cache, restart

## Troubleshooting

### Widget doesn't appear after restart
1. Check `chrome/utils/boot.sys.mjs` exists (fx-autoconfig installed)
2. Open Browser Console (`Ctrl+Shift+J`) for `[ZenNotes]` messages
3. Clear startup cache (`about:support`)
4. Verify files in correct locations

### DOM changes break widget
- Check `#TabsToolbar` and `#zen-sidebar-foot-buttons` still exist in Zen DOM
- Update selectors in `notes-widget.uc.js` if Zen changed IDs

### CSS changes silently break widget
- Test CSS changes individually — do not batch large CSS refactors without browser testing
- `mask-image`, `:root` vars, `@media` blocks all need validation in Zen context
- CSS is loaded as AUTHOR_SHEET via fx-autoconfig — some properties behave differently than in content
