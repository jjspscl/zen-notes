# Zen Notes Widget — Agent Guide

> Quick reference for building and maintaining this Zen Browser mod.

## Project Context

Zen Browser mod that injects a persistent, collapsible notes widget into the sidebar, pinned above the workspace indicators.

- **Mechanism**: `userChrome.js` + `userChrome.css`
- **Loader Required**: `fx-autoconfig` (or compatible `userChrome.js` loader)
- **Storage**: `Services.prefs` string preference (`zen.notes.content`)
- **Target Browser**: Zen Browser v1.7x+

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for milestones and current status.

## Build Steps

1. Edit `notes-widget.uc.js` or `style.css`
2. Ensure `fx-autoconfig` loader is installed in Zen Browser (program + profile files)
3. Copy files to Zen profile `chrome/` directory:
   - `style.css` → `chrome/userChrome.css` (standard Firefox chrome stylesheet)
   - `notes-widget.uc.js` → `chrome/JS/`
   - `preferences.json` → `chrome/` (optional, for pref defaults)
4. Clear startup cache (via `about:support` or delete `startupCache/` folder)
5. Restart Zen Browser
6. Verify widget appears between tabs and workspace indicators
7. Test collapse/expand, text persistence, theme matching, text wrapping

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

## Coding Conventions

### JavaScript (`*.uc.js`)
- Preference prefix: `zen.notes.*`
- Use `Services.prefs` for storage, not file I/O
- Wait for DOM ready before injection (`gBrowserInitialized` or `DOMContentLoaded`)
- Clean up event listeners on window unload
- No external dependencies — Zen chrome APIs only

### CSS (`style.css`)
- Theme matching: `light-dark(black, white)` and `--zen-colors-*` vars
- No inline styles — all widget styling in this file
- Sidebar-safe: `flex-shrink: 0`, avoid `position: absolute` inside sidebar
- Prefix all selectors with `#zen-notes-widget` to avoid collisions

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

### Storage Limits
`Services.prefs` string prefs have a soft limit around 1MB. For a single note this is ample.

### Compatibility Risks
- Zen sidebar DOM changes between versions may break injection selector
- Other sidebar mods may conflict if they manipulate the same parent node

## Release Process

1. Update `mod.json` version
2. Update `ROADMAP.md` status
3. Tag release in git
4. Provide manual install instructions (no Zen Mod Store publish planned for now)
