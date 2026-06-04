# Zen Notes Widget — Roadmap

## Vision

A persistent, collapsible rich-text notes widget pinned to the bottom of Zen Browser's sidebar, sitting just above the workspace indicators.

## Current Version

**v0.1.1 Alpha** — Plain text widget with persistence, theme matching, and layout fixes.

## Milestones

### v0.1 — Alpha ✅ Complete
- [x] Project scaffolding and workspace setup
- [x] `mod.json` metadata
- [x] DOM injection above workspace indicators (using `#zen-sidebar-foot-buttons`)
- [x] `contenteditable` text area with `Services.prefs` persistence
- [x] Collapsible/expandable header
- [x] Zen theme matching (light/dark modes)
- [x] Basic height constraints (min 100px, default 200px, max 400px)
- [x] Manual install README

**v0.1.1 Fixes:**
- [x] Fixed text wrapping — long text no longer expands sidebar width
- [x] Fixed collapsed header visibility — full header bar with chevron remains visible
- [x] Corrected DOM insertion point — widget now sits between tabs and bottom toolbar

### v0.2 — Rich Text Toolbar 🚧 Planned
- [ ] Bold, italic, bullet list buttons
- [ ] Toolbar positioned above text area
- [ ] Keyboard shortcuts (Ctrl+B, Ctrl+I)
- [x] Placeholder text when empty *(already done in v0.1)*

### v0.3 — Polish & Config 🚧 Partially Done
- [ ] Resizable height (drag handle)
- [x] `preferences.json` integration: default height, collapsed state
- [x] Smooth CSS transitions
- [ ] Zen Mod JSON export for one-click install

### v1.0 — Release Ready
- [ ] `fx-autoconfig` compatibility verified across Zen versions
- [ ] Zen Browser v1.7x+ and v1.8x tested
- [ ] Packaged as importable Zen Mod
- [ ] Publish to Zen Mods store (if JS mods accepted)

## Future Ideas

- Multiple notes (tabbed interface)
- Export to Markdown / plain text file
- Search within note
- Word/character count display
- Timestamps on edits
- Sync across devices (future scope)
