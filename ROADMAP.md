# Zen Notes Widget — Roadmap

## Vision

A persistent, collapsible, lean notes widget pinned to the bottom of Zen Browser's sidebar, with a global notes library and per-workspace pinned note state.

## Current Version

**v2.0.4** — Adds strikethrough formatting and interactive checkbox/todo lists.

## Release Channels

- **Stable channel**: `main` branch, normal SemVer (`vX.Y.Z`), official GitHub releases, and Sine marketplace installs.
- **Beta channel**: `beta` branch, prerelease SemVer (`vX.Y.Z-beta.N`), GitHub prereleases, and tester/custom installs.
- **Install behavior**: beta keeps the same mod ID (`zen-notes`) and preference namespace as stable, so beta replaces stable in a profile instead of running side-by-side.
- **Storage policy**: beta storage migrations must be forward-safe or explicitly documented as forward-only before release.

## v2 Major Release Tracks

### M0 — Workspace Contract Validation
- [x] Research likely workspace selectors, events, and pref hooks
- [ ] Verify runtime workspace UUID source in Zen directly
- [ ] Verify switch behavior across restart, rename, and reorder
- [ ] Confirm release blocker if runtime contract is unstable

### M1 — Sine Foundation
- [x] Add root `theme.json`
- [x] Convert `preferences.json` to Sine UI schema
- [x] Move version/source-of-truth validation toward Sine metadata
- [ ] Submit stable `main` to `sineorg/store`

### M2 — Global Notes Library (schema v3)
- [x] Add versioned `zen.notes.data` store
- [x] Preserve legacy single-note prefs for migration/debugging
- [x] Refactor from per-workspace note sets to single global `notes[]` library
- [x] Each workspace stores only `pinnedActiveNoteId` in `workspaceState`
- [x] v2→v3 migration flattens workspace buckets with ID collision detection
- [x] Delete reparation: deleting a note repairs all workspace refs
- [ ] Validate migration behavior against real v1/v2 user data

### M3 — Note Management Screen
- [x] Add central manager overlay for rename, reorder, open, and hard delete
- [ ] Add richer settings and future search/export hooks

### M4 — Sidebar UX
- [x] Title trigger button with chevron, anchored popover note selector
- [x] Popover keyboard navigation (arrows, Enter, Home/End, Escape)
- [x] Focus management: auto-focus selected row, return focus on close
- [x] Keep compact pinned widget feel

### M5 — Lists
- [x] Add bullet list formatting
- [x] Add numbered list formatting
- [x] Add checkbox/todo list formatting
- [ ] Decide whether explicit nesting UX belongs in a later release

## Release follow-up

- Validate Zen workspace identity across switch/restart/rename/reorder before broad promotion.
- Submit stable `main` to `sineorg/store` and confirm ingestion from root `theme.json`.
- Continue testing legacy v1/v2 note migration against real user data.

## Post-2.0 pipeline

- Keep `main` stable and marketplace-ready.
- Create or refresh `beta` from `main` after each official release.
- Start the next beta at the next target version, for example `2.1.0-beta.1`.
- Promote `beta` back to `main` only after validation and migration checks pass.
- For stable hotfixes, patch `main` first, tag a stable release, then merge or cherry-pick back to `beta`.
