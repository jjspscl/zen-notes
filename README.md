# Zen Notes Widget

A lean, persistent block-notes widget for [Zen Browser](https://zen-browser.app/), pinned to the sidebar above the workspace indicators.

![Version](https://img.shields.io/badge/version-2.5.0--beta.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## v2.5 beta highlights

- **Notion-like blocks** — paragraph, headings, bullets, numbered lists, nested to-dos, toggles, quotes, callouts, dividers, and code blocks
- **Inline formatting** — bold, italic, underline, strikethrough, inline code, and links
- **Safer editing** — flat block model, structural operations without `execCommand`, custom undo/redo, and IME-aware updates
- **More resilient storage** — atomic JSON file writes, rolling backups, cross-window updates, and a v4 preference mirror for rollback
- **Keyboard tools** — markdown shortcuts, `/` block menu, Tab indentation, and Alt+Shift+Up/Down block movement
- **Focus-scoped shortcuts** — editor shortcuts do not affect the browser when focus is outside the widget

## Installation

Zen Notes now includes root-level `theme.json` and Sine-compatible `preferences.json` metadata for Sine-first distribution.

### Preferred path

Zen Notes is Sine-ready. Until the marketplace listing is accepted, install it in [Sine](https://github.com/CosmoCreeper/Sine) as an unpublished/custom mod from `https://github.com/jjspscl/zen-notes`.

After marketplace acceptance, stable releases install from the Sine marketplace.

### Development / local testing

For development, run `npm ci`, `npm test`, then `npm run zen` to open a live-reloading XHTML harness in Windows Zen with a disposable profile. The harness uses stubbed storage; test actual file persistence using a Sine-installed beta. Sine does not support a local-folder mod install, and files must not be copied into a browser profile. Set `ZEN_PATH` if Zen is not at its default Windows location.

## Usage

- **Format text** with the toolbar or keyboard shortcuts
- **Change block type** by typing `/` at a block start and choosing a type
- **Create lists** with `- `, `1. `, or `[] `, then use Tab / Shift+Tab to indent or outdent
- **Move blocks** with Alt+Shift+Up/Down
- **Collapse or expand** by clicking the header

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Underline | `Ctrl+U` |
| Strikethrough | `Ctrl+Shift+X` |
| Bullet list | `Ctrl+Shift+L` |
| Numbered list | `Ctrl+Shift+O` |
| Checklist | `Ctrl+Shift+C` |
| Indent block | `Tab` |
| Outdent block | `Shift+Tab` |
| Move block | `Alt+Shift+↑` / `Alt+Shift+↓` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Change block | `/` at start of block |

## Release status

`2.5.0-beta.1` is the first block-editor beta. The XHTML harness exercises editing in Zen, but real storage, migration and multi-window behavior still need verification with the beta mod installed through Sine.

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

## Theme Requests

Zen Notes ships hardcoded color presets for popular schemes. Each preset is one CSS block defining five tokens (`--zen-notes-bg`, `--zen-notes-text`, `--zen-notes-border`, `--zen-notes-surface`, `--zen-notes-surface-strong`).

To request or contribute a preset:

1. **Open an issue** with the palette name, hex values, and the official source URL.
2. Alternatively, **submit a PR** adding one CSS block to `style.css` under `[data-preset="your-palette"]` and one entry in `preferences.json` and `zen-notes-core.uc.js:PRESETS`.

Presets must be from an established color scheme with a permissive license (MIT, Apache-2.0, etc.). Include an attribution comment in the CSS block.

### Palette attributions

- **Catppuccin** — MIT, © 2021 Catppuccin. All four flavors.
- **Dracula** — MIT, Dracula Theme / Zeno Rocha.
- **Nord** — MIT, © 2016-present Sven Greb.
- **Gruvbox** — MIT/X11, morhetz.
- **Tokyo Night** — Apache-2.0, folke. Apache-2.0 carries a NOTICE-preservation clause; see the [official repo](https://github.com/folke/tokyonight.nvim) for details.
- **Rosé Pine** — MIT, mvllow.
- **Solarized** — MIT, © 2011 Ethan Schoonover.
- **Everforest** — MIT, © 2019 sainnhe.

## License

MIT
