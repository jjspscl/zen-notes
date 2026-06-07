# Changelog

All notable changes to Zen Notes Widget will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

## [2.0.0] — 2026-06-07

### Added
- Root `theme.json` and Sine-compatible preferences metadata for the v2 release line.
- Workspace-aware `zen.notes.data` storage with legacy single-note migration preservation.
- Sidebar note selector and central note manager overlay.
- Bullet and numbered list formatting controls.
- Global notes library with per-workspace pinned note state (schema v3).
- Title trigger button showing current pinned note; click opens anchored popover list.
- Popover keyboard navigation: arrow keys, Enter to select, Home/End, Escape to close.
- Auto-focus selected row on popover open; focus returns to trigger on close.
- v2→v3 migration flattens workspace note sets into global library with ID collision detection.
- Delete reparation: deleting a note repairs all workspace pinned refs pointing at it.

### Changed
- Version source of truth now includes `theme.json` plus runtime/header sync checks.
- Release packaging and CI now validate Sine metadata alongside existing JS/CSS checks.
- Storage model refactored from per-workspace note sets to a single global `notes[]` library.
- Each workspace stores only `pinnedActiveNoteId` in `workspaceState`.
- Quick-add button removed from header; new note creation moved exclusively to manager overlay.
- Header action order: color picker first, then manager button.
- Title group (label + `<select>`) replaced with `.zen-notes-title-trigger` button + popover.

### Removed
- Per-workspace `notes[]` buckets (replaced by global notes library).
- Quick new note button from widget header.

### Notes
- Stable releases track `main`; beta releases track `beta` and replace stable installs in the same profile.
- Beta builds may include forward-only storage migrations and should be used by testers only.

## [1.0.1] — 2025-06-04

### Fixed
- Color picker palette now reorders swatches so the current color is always rightmost.
- Mouse cursor stays in place when opening the picker, preventing accidental color changes.

## [1.0.0] — 2025-06-04

### Added
- Stable v1.0 release with full CI/CD pipeline and namespaced ZIP distribution.
- `install.md` end-user installation guide.
- `CONTRIBUTING.md` with conventional commits guide.

### Infrastructure
- Automated version bump script (`scripts/bump.js`).
- GitHub Actions CI workflow (version sync, header, CSS, syntax checks).
- GitHub Actions release workflow (ZIP + GitHub Release on tag push).

## [0.2.2-alpha] — 2025-06-04

### Security
- Added `sanitizeHTML()` placeholder for future XSS hardening.
  - DOMParser-based sanitization was attempted but caused the widget
    to fail silently in XUL context. Reverted to identity with TODO.
  - Current threat model: local-only prefs store + chrome context =
    minimal remote XSS vector.

### Added
- Periodic crash-safe auto-save every 5 seconds (flushes dirty state).
- Top-level error boundary (`createWidgetSafe`) to prevent loader chain breakage.
- Graceful DOM degradation with `console.warn` if sidebar injection point missing.
- Startup banner: `console.info('[ZenNotes] v0.2.2-alpha loaded')`.
- Named constants for all magic numbers (`DEBOUNCE_MS`, `FOCUS_DELAY_MS`, etc.).

### Fixed
- ResizeObserver no longer thrashes `Services.prefs` during drag-to-resize.
- Global event listeners (`mousemove`, `mouseup`, `click`) now properly removed
  on window unload via named references in cleanup.
- Auto-save interval cleared on unload (prevents orphaned timers).
- Locale-aware date formatting (removed hardcoded `'en-US'`).

### Accessibility
- Header: `role="button"`, `aria-expanded`, `aria-label`.
- Color dot and swatches: `role="button"`, `aria-label`.
- Toolbar buttons: `aria-pressed` state syncs with bold/italic.
- Editor: `aria-label="Notes editor"`.
- Toggle chevron: `aria-hidden="true"`.

### Infrastructure
- Added MIT `LICENSE` file.
- Added `.editorconfig`.
- Added CI/CD validation and release pipelines.

## [0.2.1-alpha] — 2025-06-04

### Fixed
- Toolbar visibility: body converted from XUL vbox to HTML div.
- Right-side text clipping: added `box-sizing: border-box`.
- External drag bar above widget for resizing.
- Prevent image paste in editor.
- Auto-focus editor on expand.
- Escape key collapses widget.

## [0.2.0-alpha] — 2025-06-03

### Added
- Pastel card colors (yellow, orange, purple, green, blue) with color picker.
- Bold / Italic toolbar buttons with keyboard shortcuts (`Ctrl+B`, `Ctrl+I`).
- HTML persistence instead of plain text.
- Last edited date display.
- Card styling with border-radius, shadow, and border.
- Fixed body clipping and unbroken-string overflow.

## [0.1.1-alpha] — 2025-06-02

### Fixed
- Text wrapping: long text no longer expands sidebar width.
- Collapsed header visibility: full header bar with chevron remains visible.
- Corrected DOM injection point: widget now sits between tabs and bottom toolbar.

## [0.1.0-alpha] — 2025-06-02

### Added
- Initial widget scaffold with `mod.json` metadata.
- DOM injection above workspace indicators.
- `contenteditable` text area with `Services.prefs` persistence.
- Collapsible/expandable header.
- Zen theme matching (light/dark modes).
- Basic height constraints (min 100px, default 200px, max 400px).
- Manual install README.

[Unreleased]: https://github.com/jjspscl/zen-notes/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/jjspscl/zen-notes/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/jjspscl/zen-notes/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/jjspscl/zen-notes/compare/v0.2.2-alpha...v1.0.0
[0.2.2-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.1-alpha...v0.2.2-alpha
[0.2.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.0-alpha...v0.2.1-alpha
[0.2.0-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.1-alpha...v0.2.0-alpha
[0.1.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/jjspscl/zen-notes/releases/tag/v0.1.0-alpha
