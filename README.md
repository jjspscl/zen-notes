# Zen Notes Widget

A lean, workspace-aware notes widget for [Zen Browser](https://zen-browser.app/), pinned to the bottom of the sidebar above the workspace indicators.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## v2 Highlights

- **Global notes library** — a single shared `notes[]` across workspaces; each workspace pins its active note
- **Title trigger popover** — click the current note title in the header to open an anchored note selector
- **Central manager** — rename, reorder, open, and hard-delete notes from a dedicated manager screen
- **Lists** — bullet and numbered list formatting alongside bold and italic
- **Legacy migration** — v1 single-note and v2 per-workspace data migrates into v3 global model with ID collision resolution
- **Lean pinned UX** — compact card stays in the sidebar while management moves into a central overlay

## Installation

Zen Notes now includes root-level `theme.json` and Sine-compatible `preferences.json` metadata for Sine-first distribution.

### Preferred path

Zen Notes is Sine-ready. Until the marketplace listing is accepted, install it in [Sine](https://github.com/CosmoCreeper/Sine) as an unpublished/custom mod from `https://github.com/jjspscl/zen-notes`.

After marketplace acceptance, stable releases install from the Sine marketplace.

### Development / local testing

Manual development testing can still use a `userChrome.js` loader such as [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig). See [install.md](./install.md).

## Usage

- **Switch notes** — click the title button in the header to open the popover; click any note to pin it
- **Create note** — open the manager (`≡`) and click "New note"
- **Manage notes** with the `≡` button to rename, reorder, open, or hard-delete
- **Format text** with bold, italic, bullet list, and numbered list controls
- **Change color** with the header color dot
- **Collapse or expand** by clicking the header

## Release status

`2.0.0` is the stable v2 release for the global notes library and title-trigger popover UX. Sine marketplace submission is pending acceptance.

## Release channels

- **Stable**: `main` branch, normal SemVer versions like `2.0.0`, tagged as `v2.0.0`, and intended for Sine marketplace users.
- **Beta**: `beta` branch, prerelease versions like `2.1.0-beta.1`, tagged as `v2.1.0-beta.1`, and intended for testers.
- **Install behavior**: beta uses the same mod ID (`zen-notes`) and preferences as stable. Installing beta replaces the stable install for that browser profile.
- **Storage safety**: beta builds may include forward-only storage migrations. Testers should treat beta as an upgrade path, not a side-by-side install.

## Docs

- [install.md](./install.md)
- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
