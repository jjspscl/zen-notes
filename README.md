# Zen Notes Widget

A persistent, collapsible notes widget for [Zen Browser](https://zen-browser.app/), pinned to the bottom of the sidebar just above the workspace indicators.

![Version](https://img.shields.io/badge/version-0.1.1--alpha-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Persistent Notes** — Your note survives browser restarts
- **Collapsible** — Click the header to hide/show the editor
- **Zen Theme Match** — Automatically adapts to light and dark modes
- **Minimal** — Plain text editor, zero distractions
- **Auto-save** — Saves as you type (debounced)
- **Text Wrapping** — Long text wraps inside the editor without expanding the sidebar

## Installation

### Prerequisites

You need a `userChrome.js` loader installed in Zen Browser. If you don't have one:

1. Install [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) or [zen-autoconfig-script](https://github.com/RayZ3R0/zen-autoconfig-script)
2. Follow their setup instructions (usually involves copying files into your Zen profile `chrome/` folder)
3. Restart Zen Browser

### Install the Mod

1. Locate your Zen profile folder:
   - Go to `about:support` in the address bar
   - Click **"Open Folder"** next to **Profile Folder**

2. Inside your profile, ensure there is a `chrome/` folder. Create it if missing.

3. Inside `chrome/`, ensure there is a `JS/` folder. Create it if missing.

4. Copy the mod files:
   - `style.css` → `chrome/userChrome.css` (or add `@import url("zen-notes/style.css");` to your existing `userChrome.css`)
   - `notes-widget.uc.js` → `chrome/JS/`

5. Clear the startup cache:
   - Go to `about:support` in the address bar
   - Click **"Clear startup cache"** in the top-right corner, then confirm

6. The widget should appear at the bottom of your sidebar, above the workspace indicators.

## Usage

- **Type** in the editor — your note saves automatically
- **Click "Notes"** to collapse or expand the widget
- Your note persists across browser sessions

## Uninstall

1. Remove `chrome/JS/notes-widget.uc.js`
2. Remove the `@import` or CSS rules from `chrome/userChrome.css`
3. Restart Zen Browser

To also clear your saved note, go to `about:config`, search for `zen.notes.content`, and reset the preference.

## Compatibility

- **Zen Browser**: 1.7.0+
- **Requires**: `fx-autoconfig` or compatible `userChrome.js` loader

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for upcoming features (rich text toolbar, resizable height, Zen Mod Store export).

## License

MIT
