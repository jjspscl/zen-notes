# Zen Notes Widget

A lean, workspace-aware notes widget for [Zen Browser](https://zen-browser.app/), pinned to the bottom of the sidebar above the workspace indicators.

![Version](https://img.shields.io/badge/version-2.0.0--beta-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## v2 Beta Highlights

- **Global notes library** — a single shared `notes[]` across workspaces; each workspace pins its active note
- **Title trigger popover** — click the current note title in the header to open an anchored note selector
- **Central manager** — rename, reorder, open, and hard-delete notes from a dedicated manager screen
- **Lists** — bullet and numbered list formatting alongside bold and italic
- **Legacy migration** — v1 single-note and v2 per-workspace data migrates into v3 global model with ID collision resolution
- **Lean pinned UX** — compact card stays in the sidebar while management moves into a central overlay

## Installation

Zen Notes now includes root-level `theme.json` and Sine-compatible `preferences.json` metadata for Sine-first distribution.

### Preferred path

Install through [Sine](https://github.com/CosmoCreeper/Sine) once this repo is published to `sineorg/store`.

### Development / local testing

Until store publication is complete, local testing still uses a `userChrome.js` loader such as [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig). See [install.md](./install.md).

## Usage

- **Switch notes** — click the title button in the header to open the popover; click any note to pin it
- **Create note** — open the manager (`≡`) and click "New note"
- **Manage notes** with the `≡` button to rename, reorder, open, or hard-delete
- **Format text** with bold, italic, bullet list, and numbered list controls
- **Change color** with the header color dot
- **Collapse or expand** by clicking the header

## Release status

`2.0.0-beta` global notes library with title-trigger popover UX. Final v2 release still depends on validating the Zen workspace contract in runtime.

## Docs

- [install.md](./install.md)
- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
