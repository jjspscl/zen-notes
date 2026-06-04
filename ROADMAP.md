# Zen Notes Widget — Roadmap

## Vision

A persistent, collapsible rich-text notes widget pinned to the bottom of Zen Browser's sidebar, sitting just above the workspace indicators.

## Current Version

**v1.0.0** — CI/CD pipeline and release automation.

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

### v0.2.2 — Security & Robustness Hardening ✅ Complete
- [x] Added periodic crash-safe auto-save (5s interval)
- [x] Added top-level error boundary (`createWidgetSafe`)
- [x] Fixed ResizeObserver feedback loop during drag
- [x] Fixed global event listener leaks on unload
- [x] Fixed hardcoded en-US locale in date formatting
- [x] Added graceful DOM degradation warning
- [x] Added accessibility attributes (aria-expanded, aria-pressed, aria-label)
- [x] Extracted magic numbers to named constants
- [x] Added startup console banner for debugging
- [x] Added `sanitizeHTML()` placeholder (DOMParser approach deferred post-v1)
- [x] Added MIT `LICENSE` and `.editorconfig`

### v0.3 — CI/CD & Distribution ✅ Complete
- [x] GitHub Actions CI workflow (version sync, header, CSS, syntax checks)
- [x] GitHub Actions release workflow (ZIP + GitHub Release on tag push)
- [x] Automated version bump script (`scripts/bump.js`)
- [x] Validation scripts (version, header, CSS)
- [x] Build script for namespaced release ZIP
- [x] `CONTRIBUTING.md` with conventional commits guide
- [x] `CHANGELOG.md` with semver formatting
- [x] `install.md` end-user installation guide

### v1.0 — Release Ready ✅ Complete
- [x] Core widget stable (daily usage validated)
- [x] Packaged as distributable ZIP with namespaced chrome/ folder
- [x] CI/CD pipeline operational (automated release on git tag)
- [ ] `fx-autoconfig` compatibility verified across Zen versions *(deferred to post-v1 testing)*
- [ ] Zen Browser v1.7x+ and v1.8x tested *(deferred to post-v1 testing)*
- [ ] Dark mode color variants (CSS) *(deferred to v1.1 — requires per-change browser testing)*
- [ ] Publish to Zen Mods store *(blocked: JS mods not supported by store)*

## Future Ideas

- Multiple notes (tabbed interface)
- Export to Markdown / plain text file
- Search within note
- Word/character count display
- Timestamps on edits
- Sync across devices (future scope)
