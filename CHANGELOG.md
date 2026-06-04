# Changelog

All notable changes to Zen Notes Widget will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/jjspscl/zen-notes/compare/v0.2.2-alpha...HEAD
[0.2.2-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.1-alpha...v0.2.2-alpha
[0.2.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.0-alpha...v0.2.1-alpha
[0.2.0-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.1-alpha...v0.2.0-alpha
[0.1.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/jjspscl/zen-notes/releases/tag/v0.1.0-alpha
