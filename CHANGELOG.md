# Changelog

All notable changes to Zen Notes Widget will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.2] — 2026-07-28

### Fixed
- **Widget width**: added `min-width: min(300px, calc(100% - 16px))` to `#zen-notes-widget` so the editor never drops below ~38 characters per line, while the clamp prevents overflow in collapsed/compact sidebar modes (the floor self-disables when the sidebar is narrower than 300px). The 300px value is the largest safe floor: editor content width = widget − 44px (margins + padding + editor padding), yielding ~256px editor width. At 13px Inter that is ~38 chars/line — below Butterick's 45-char ideal but above the hostile-wrapping threshold, and it does not exceed narrow real-world Zen sidebar configurations.

## [2.4.1] — 2026-07-28

### Fixed
- **Icon rendering**: all 8 toolbar SVGs now declare `fill="none" stroke="white"` so mask-icons render in browser and sidebar contexts. Circle and text elements inside icon SVGs are explicitly filled for legibility.
- **Sidebar width**: toolbar `flex-wrap: wrap` prevents 8 buttons + dividers from imposing a ~240px minimum width. `MIN_HEIGHT` raised 160→190 to accommodate a potential second toolbar row. The classic white-space / overflow / text-wrap width bug does not affect this version.
- **"Migrated note" header label**: title is static "Zen Notes" — the widget no longer reads `state.note.title` to render the header. The migration code also creates notes titled "Zen Notes" instead of "Migrated note".
- **Color mode dropdown removed**: `zen.notes.colorMode` pref and its `preferences.json` dropdown are gone. Adapt mode CSS blocks, classic-mode five-pastel CSS, the manager overlay color-swatch picker, and all associated JS plumbing (`PREF_COLOR_MODE`, `COLORS`, `COLOR_MODES`, `DEFAULT_COLOR`, `isColorValid`, `ensureManagerUI`, `renderManager`) are deleted. The widget always applies `data-preset` from `zen.notes.preset` (configuration → "Color scheme").
- **Escape key crash**: `onDocumentKeydown` no longer dereferences `managerOverlay` unguarded on fresh-window loads.
- Stale multi-note and workspace descriptions in `preferences.json` rewritten.

### Removed
- `zen.notes.colorMode` preference, adapt/classic CSS blocks, color-swatch picker, and all `COLORS`/`COLOR_MODES` plumbing.

## [2.4.0] — 2026-07-28

### Added
- **Color presets**: 15 handpicked palette families (Catppuccin 4, Dracula, Nord, Gruvbox 2, Tokyo Night, Rosé Pine 2, Solarized 2, Everforest 2) with hardcoded hex tokens — switch via `zen.notes.preset` in Sine settings.
- **Adapt mode**: new `zen.notes.colorMode` three-way toggle (`classic` / `adapt` / `preset`). Adapt mode reads Zen-native `--zen-*` variables, with fallback chains over Nebula glass and Natsumi vars, terminating in CSS system colors — so the note surface always matches the browser chrome regardless of theme. Pure CSS, no JS probing.
- **Links**: `<a>` is now an allowed tag. Paste a URL over a selection to wrap it; paste on a collapsed caret to insert linked text. Ctrl+K on a selection prompts for a URL. Clicking a link opens a new tab via Zen's tab API. `href` is validated on sanitize against `http:`/`https:`/`mailto:` only — `javascript:` and other schemes are stripped.
- **Theme Requests** section in README with contribution contract (one CSS block, five tokens per preset) and separate Apache-2.0 attribution for Tokyo Night.
- **Perf**: `normalizeEditorTree` debounced via `_normalizeDigests` WeakMap — skips redundant passes when content hasn't changed. Manager overlay DOM deferred to first open (`ensureManagerUI`). Only one `ResizeObserver` for the widget.

### Changed
- **Complete visual redesign**: toolbar converted to a single segmented control with inline SVG mask icons (bold, italic, underline, strikethrough, bullet, numbered, checklist, link). Header simplified to title + one settings button. Recessed toolbar surface, pill active state, hairline dividers. Editor flush with container, footer at 50% opacity. Radius sourced from `--zen-border-radius`.
- **Single note**: the multi-note library, note selector, popover, and all note-management CRUD functions are removed. The widget holds exactly one note. Any v2/v3 multi-note state is written verbatim to `zen.notes.dataBackup` and replaced with a new note; that content is recoverable only as JSON from the backup pref. Notes from v1 (the single-note `zen.notes.content` era) are the exception — their text is carried into the new note, titled "Migrated note".
- **Sine-only install**: all `fx-autoconfig` / `_ucUtils` / `userChrome.js` documentation stripped from README, install guide, contributing guide, and AGENTS.md. Install is Sine-only via ZIP.
- **Code splitting**: the monolithic `notes-widget.uc.js` is split into three Sine-loaded modules — `zen-notes-core.uc.js` (prefs, storage, state model), `zen-notes-editor.uc.js` (sanitizer, normalizer), `zen-notes-ui.uc.js` (DOM, lifecycle) — loaded in order via `theme.json` `scripts` map with `loadOrder`. Same behavior, smaller composable files.
- `build-release.js` is now manifest-driven: it copies every file listed in `theme.json` `scripts` and a static set of support files, so any future module additions ship automatically.

### Removed
- Multi-note library, popover, note selector, note create/rename/delete/reorder, workspace-specific pinned notes.
- `fx-autoconfig` documentation across all mod docs.
- `notes-widget.uc.js` — replaced by the three split modules.

### Fixed
- No functional regressions in lists, checklists, markdown shortcuts, caret navigation, paste, formatting, or undo — all verified by `node --check` and manual test pass.
- `style.css` banner corrected to `v2.4.0`.
- `AGENTS.md` no longer claims `--zen-colors-*` matching existed before the token layer — now correctly describes the new variable contract.

## [2.3.9] — 2026-07-27

### Changed
- Caret-key handling is confirmed working in Zen, so the temporary diagnostics are gone. The document-level capture listener has been removed entirely, and the auto-logging that reported the first twelve keypresses no longer runs — it existed to diagnose the focus-escape bug and would otherwise print to every user's console. Setting `zen.notes.debugKeyNav` still logs caret movement and whether the system-group guard attached.

## [2.3.8] — 2026-07-27

### Fixed
- Arrow keys moved focus to the page instead of the caret. Suppressing propagation in both the normal and system event groups (2.3.4, 2.3.7) did not help, which showed no listener was stealing the key — the default action was. Gecko found no active editing session for the caret to move within, treated the key as unhandled, and its focus manager handed focus to the content `<browser>`; the caret had never been moving at all. Caret keys are now handled explicitly via `Selection.modify()`, Gecko's native caret-movement primitive, which is bidi-aware and line-height aware and mutates only the selection, never document content, so the undo buffer is unaffected. The default action is suppressed only once the caret has actually moved, so an unhandled case degrades to native behaviour instead of a dead key.

### Added
- Shift+arrows extend the selection, Ctrl/Meta+Left/Right move by word, Home/End jump to line boundaries, and PageUp/PageDown move by ten lines. All other modifier combinations pass through to Zen's own shortcuts.

## [2.3.7] — 2026-07-27

### Fixed
- Arrow keys still moved focus from the editor to the content area despite the 2.3.4 guard. Diagnostics confirmed the guard ran and called `stopPropagation()`, yet focus still escaped — because Gecko runs two event groups, and XUL `<key>` elements and built-in chrome handlers live in the system group, which a normal-group `stopPropagation()` cannot stop. The guard is now also registered with `mozSystemGroup: true` (chrome-only), placing it in the same group as the competing handler so the event is stopped before it escapes. `preventDefault` is still deliberately not called, so native caret movement and the undo buffer are untouched. The same guard is applied to the note rename input, and startup logs whether it attached.

## [2.3.6] — 2026-07-27

### Changed
- Caret-key diagnostics now self-report the first 12 keypresses without needing `zen.notes.debugKeyNav` set in `about:config`, then go quiet. Requiring the pref meant the diagnostic silently produced nothing. The output also now states directly whether focus escaped the editor, rather than leaving that to be inferred from element names. Setting the pref still forces logging on indefinitely.

## [2.3.5] — 2026-07-27

### Fixed
- `Removed unsafe attribute. Element: ul. Attribute: xmlns.` warnings persisted after 2.3.4. That release stopped the sanitizer from *writing* the attribute, but notes saved by earlier versions still carry it in their stored HTML, so the warning fired while parsing that legacy content — before the sanitizer could strip it. The attribute is now removed from the input string ahead of parsing, so existing notes heal on their next load.

## [2.3.4] — 2026-07-27

### Fixed
- Arrow keys moved focus out of the editor into the browser instead of moving the caret. The editor is an HTML `contenteditable` element inside `#TabsToolbar`, which Firefox registers as a keyboard-navigable toolbar area (`CustomizableUI.AREA_TABSTRIP`). Its `ToolbarKeyboardNavigator` claims Left/Right to walk between toolbar buttons, and Zen's vertical-tabs handling claims Up/Down, so every unmodified arrow key that bubbled out of the editor was consumed before the caret could move. Caret-navigation keys (arrows, Home, End, PageUp, PageDown) now stop propagating at the editor and at the note rename input, and the widget opts out of toolbar keyboard navigation via `keyNav="false"`. `preventDefault` is deliberately not called, so native caret movement and the undo buffer are untouched. Keys held with Ctrl, Meta, or Alt still reach Zen's own shortcuts.
- Repeated `Removed unsafe attribute. Element: ul. Attribute: xmlns.` warnings on every save, load, and note switch involving a list. Zen's chrome document is `application/xhtml+xml`, so serializing namespaced elements through `innerHTML` emitted an explicit `xmlns` attribute into the stored note. That attribute round-tripped back into the sanitizer on the next load, where Gecko stripped it and logged a warning. The sanitizer and normalizer now build their scratch tree in a detached HTML document, which serializes without namespace declarations. Elements inserted into the live editor are still created in the chrome document.

### Added
- `zen.notes.debugKeyNav` pref (default `false`). When enabled, logs caret-key propagation and the resulting focus target to the Browser Console for diagnosing keyboard-focus issues.

## [2.3.3] — 2026-07-27

### Fixed
- List and checklist buttons destroyed the selected text instead of creating a list. Zen's chrome document is `application/xhtml+xml`, where `Element.tagName` is lowercase (`"ul"`), not uppercased as in HTML documents (`"UL"`). Every live-DOM comparison against an uppercase tag name therefore failed: valid lists were reported as malformed, which made the structural check run the normalizer on correct markup, and the normalizer in turn treated every `<li>` as an orphan and unwrapped the content out of existence. All tag comparisons now use `localName`, which is lowercase in both document types. This was the underlying cause of the list and checkbox failures across 2.3.0 through 2.3.2; the earlier fixes addressed real but secondary issues in the same code path.

## [2.3.2] — 2026-07-27

### Fixed
- List, numbered list, and checklist toolbar buttons did nothing when clicked. Clicking a button moves focus out of the editor, which clears the selection before the handler runs, so the selection lookup returned nothing and `execCommand` executed with no target. The selection is now snapshotted on `mousedown`, before focus leaves the editor, and the button no longer blurs the editor at all. When no selection can be recovered the caret is placed in the editor rather than leaving the command with nowhere to apply.

## [2.3.1] — 2026-07-27

### Fixed
- Selected text disappeared when applying a list or checklist to a highlighted range. Selecting whole blocks anchors the selection boundaries on elements rather than text nodes, which the offset-based selection save could not resolve — it returned no offsets, so the restore built a range defaulting to a position outside the editor, and `execCommand` then ran against that range and removed the content. Boundaries are now measured by range length, so element-anchored selections resolve correctly, and a restored range can never fall outside the editor.
- Selection end offset was measured against an incomplete character count when the start and end sat in different text nodes, so multi-block selections could be restored short.
- Applying a checklist to a multi-block selection only marked the list under the caret. All lists intersecting the selection are now toggled together, and the toggle only clears when every selected list is already a checklist.
- Structural repair no longer runs after every list command. It now runs only when the DOM is actually invalid, so a valid multi-block selection is left as `execCommand` set it instead of being rewritten.

## [2.3.0] — 2026-07-27

### Fixed
- Lists and checkboxes could not be deleted. Firefox `execCommand("indent")` emitted invalid `ul > ul` nesting (rendering a double `• ○` marker), and outside a list emitted `<blockquote>`, which the sanitizer unwrapped — promoting bare `<li>` elements to the editor root. Orphaned list items were unreachable by `execCommand`, so the bullet button, checklist button, and Backspace all appeared to do nothing.
- Corrupted list structure was persisted to prefs and re-applied on load, so manual repairs were overwritten on the next save or reload.
- Ordered lists were invisible to Tab/Enter/outdent handling — `getClosestList()` matched only `ul`.
- Checklist state was lost on every save. `zen-notes-checklist` was a class, but the sanitizer preserved no attributes except `data-checked`, so checklists silently degraded to plain bullet lists while checked items kept strikethrough with no checkbox.
- Caret jumped to the end of the editor after formatting; selection was restored from stale node references that `execCommand` had already replaced.
- Deleting all content left a stray `<br>` or empty list behind, suppressing the placeholder text.

### Added
- Markdown input rules: `- `, `* `, `1. `, and `[] ` convert to the matching list at the start of a line. Applied through `execCommand` so a single Ctrl+Z reverts the conversion.
- Live word and character count in the footer, sharing the date's row at no extra height. Hidden on empty notes.

### Changed
- Checklists are now marked with `data-checklist="true"` on the list element instead of a CSS class, so the state survives sanitization. Existing class-based checklists migrate automatically on first load.
- `execCommand` output is normalized and repaired rather than replaced. It remains the mutation primitive because it is the only way to preserve the native undo buffer; explicit DOM surgery is limited to nodes `execCommand` cannot reach.
- Selection is saved and restored as linear character offsets, surviving node replacement by `execCommand` and structural repair.
- Checklist styling now also covers ordered lists, so a checklist survives a bullet/number toggle.

## [2.1.0] — 2026-06-26

### Added
- Paste as plain text by default; internal paste (within editor) preserves formatting.
- Underline formatting via toolbar button (U) and keyboard shortcut (Ctrl+U).
- Save status indicator ("Saved" / "Saving…") with `aria-live="polite"`.
- Keyboard shortcut hints in toolbar tooltips (e.g., "Bold (Ctrl+B)").
- Ctrl+Shift+L / Ctrl+Shift+O / Ctrl+Shift+C shortcuts for bullet list, numbered list, and checklist toggle.
- Tab/Shift+Tab for indent/outdent within lists.

### Changed
- Paste handler now strips all foreign HTML on paste from external sources.
- Checklist click hit-test uses computed `::before` pseudo-element width instead of hardcoded `offsetX < 24` (zoom-safe).
- Format commands and toolbar clicks now save and restore selection state to prevent cursor jumps.
- Blur handler no longer destructively re-syncs editor content when it already matches the stored value.
- Enter key exits a list when pressed on an empty list item (double-Enter to break out).
- Enter key inside a checklist automatically marks the new item as unchecked (`data-checked="false"`).

### Fixed
- Cursor no longer jumps to end of editor after formatting operations.
- Editor undo history preserved on blur when content is already in sync.
- Checklist toggle works reliably at all zoom levels and font sizes.

## [2.0.4] — 2026-06-22

### Added
- Strikethrough formatting via toolbar button (S) and keyboard shortcut (Ctrl+Shift+X).
- Checkbox/todo lists via toolbar button (☐) with click-to-toggle interaction.
- Checked checklist items automatically apply strikethrough and reduced opacity.

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

[Unreleased]: https://github.com/jjspscl/zen-notes/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/jjspscl/zen-notes/compare/v2.0.4...v2.1.0
[2.0.4]: https://github.com/jjspscl/zen-notes/compare/v2.0.0...v2.0.4
[2.0.0]: https://github.com/jjspscl/zen-notes/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/jjspscl/zen-notes/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/jjspscl/zen-notes/compare/v0.2.2-alpha...v1.0.0
[0.2.2-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.1-alpha...v0.2.2-alpha
[0.2.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.2.0-alpha...v0.2.1-alpha
[0.2.0-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.1-alpha...v0.2.0-alpha
[0.1.1-alpha]: https://github.com/jjspscl/zen-notes/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/jjspscl/zen-notes/releases/tag/v0.1.0-alpha
