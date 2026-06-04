# Installation Guide

## Prerequisites

You need a `userChrome.js` loader installed in Zen Browser. If you don't have one:

1. Install [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) or [zen-autoconfig-script](https://github.com/RayZ3R0/zen-autoconfig-script)
2. Follow their setup instructions (usually involves copying files into your Zen profile `chrome/` folder)
3. Restart Zen Browser

## Install from Release ZIP

1. Download the latest release ZIP from [GitHub Releases](https://github.com/jjspscl/zen-notes/releases)
2. Extract the ZIP
3. Inside the extracted `zen-notes/` folder, locate the `chrome/` directory
4. Copy the contents of `chrome/` into your Zen profile's `chrome/` folder:
   - `JS/notes-widget.uc.js` → `chrome/JS/`
   - `preferences.json` → `chrome/`
5. Copy `userChrome.css` from the ZIP into `chrome/userChrome.css`
   - If you already have a `userChrome.css`, append the contents of the ZIP's `userChrome.css` to it
6. Clear the startup cache:
   - Go to `about:support` in the address bar
   - Click **"Clear startup cache"** in the top-right corner, then confirm
7. Zen Browser will restart. The widget should appear at the bottom of your sidebar, above the workspace indicators.

## Install from Source (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/jjspscl/zen-notes.git
   cd zen-notes
   ```
2. Copy files to your Zen profile:
   - `notes-widget.uc.js` → `chrome/JS/`
   - `style.css` → `chrome/userChrome.css` (or append to existing)
   - `style.css` → `chrome/CSS/zen-notes.uc.css` (if using fx-autoconfig CSS folder)
   - `preferences.json` → `chrome/`
3. Clear startup cache and restart Zen Browser

## Uninstall

1. Remove `chrome/JS/notes-widget.uc.js`
2. Remove the Zen Notes CSS rules from `chrome/userChrome.css`
3. Remove `chrome/preferences.json` (optional — this also clears your saved note)
4. Clear startup cache and restart Zen Browser

To also clear your saved note data, go to `about:config`, search for `zen.notes.content`, and reset the preference.

## Troubleshooting

### Widget doesn't appear after restart

1. Check that `fx-autoconfig` is properly installed (look for `chrome/utils/boot.sys.mjs` in your profile)
2. Open Browser Console (`Ctrl+Shift+J`) and look for `[ZenNotes]` messages
3. Ensure you cleared the startup cache (`about:support` → "Clear startup cache")
4. Verify files are in the correct locations:
   - `chrome/JS/notes-widget.uc.js`
   - `chrome/userChrome.css` (contains `#zen-notes-widget` rules)
   - `chrome/preferences.json`

### Widget appears but styling is broken

1. Make sure `style.css` was copied to `chrome/userChrome.css` (not just `chrome/CSS/`)
2. Check for CSS conflicts with other sidebar mods
3. Clear startup cache and restart

### Note content is lost after restart

1. Check `about:config` → `zen.notes.content` — if it's empty, the save path may be failing
2. Open Browser Console and look for `[ZenNotes] failed to save pref` errors
3. Ensure `preferences.json` is in `chrome/` so fx-autoconfig registers the prefs

## Compatibility

- **Zen Browser**: 1.7.0+
- **Requires**: `fx-autoconfig` or compatible `userChrome.js` loader
- **Not compatible** with Zen Mod Store (requires JS execution)
