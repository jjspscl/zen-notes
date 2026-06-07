# Zen Notes Widget — Roadmap

## Vision

A persistent, collapsible, lean notes widget pinned to the bottom of Zen Browser's sidebar, with note management moved into a central screen and note collections isolated per workspace.

## Current Version

**v2.0.0-beta** — Sine-first beta foundation with workspace-aware multi-note architecture.

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
- [ ] Publish repo to `sineorg/store`

### M2 — Workspace-Aware Multi-Note Storage
- [x] Add versioned `zen.notes.data` store
- [x] Preserve legacy single-note prefs for migration/debugging
- [x] Add active note state per workspace bucket
- [ ] Validate migration behavior against real v1 user data

### M3 — Note Management Screen
- [x] Add central manager overlay for rename, reorder, open, and hard delete
- [ ] Add richer settings and future search/export hooks

### M4 — Sidebar UX
- [x] Add sidebar note switcher
- [x] Add quick new note flow
- [x] Keep compact pinned widget feel

### M5 — Lists
- [x] Add bullet list formatting
- [x] Add numbered list formatting
- [ ] Decide whether explicit nesting UX belongs in a later release

## Release blockers

- Stable Zen workspace identity must be verified in runtime.
- Sine store ingestion must be validated from root `theme.json`.
- Legacy v1 note migration must be proven idempotent with no data loss.
