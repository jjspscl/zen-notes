# Zen Notes Widget — Roadmap

## Vision

A persistent, collapsible rich-text notes widget pinned to the bottom of Zen Browser's sidebar, sitting just above the workspace indicators.

## Current Version

**v0.2.2 Alpha** — Pre-v1 security, robustness, and accessibility hardening.

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
- [x] Corrected DOM injection point — widget now sits between tabs and bottom toolbar

### v0.2 — Sticky Note Redesign ✅ Complete
- [x] Pastel card colors (yellow, orange, purple, green, blue) with color picker dot
- [x] Bold, italic toolbar buttons above text area
- [x] Keyboard shortcuts (`Ctrl+B`, `Ctrl+I`)
- [x] HTML persistence instead of plain text
- [x] Last edited date display
- [x] Card styling with border-radius, shadow, and border
- [x] Fixed body clipping and unbroken-string overflow

**v0.2.1 Fixes:**
- [x] Fixed toolbar visibility — body converted from XUL vbox to HTML div
- [x] Fixed right-side text clipping — added box-sizing: border-box
- [x] Added external drag bar above widget for resizing
- [x] Prevent image paste in editor
- [x] Auto-focus editor on expand
- [x] Escape key collapses widget

### v0.3 — Polish & Config 🚧 Partially Done
- [ ] Resizable height (drag handle)
- [x] `preferences.json` integration: default height, collapsed state, color, last edited
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
