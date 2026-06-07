# Installation Guide

## Preferred path: Sine

Zen Notes v2 ships Sine-first metadata:

- `theme.json` at repo root
- Sine UI controls in `preferences.json`
- root `notes-widget.uc.js` and `style.css`

Once the repo is published to `sineorg/store`, install through [Sine](https://github.com/CosmoCreeper/Sine).

## Local beta testing

Store publication is still pending workspace-contract validation, so local testing currently uses a `userChrome.js` loader.

### Prerequisites

Install [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) or another compatible `userChrome.js` loader.

### Load from source

1. Clone the repository.
2. Copy `notes-widget.uc.js` to your Zen profile `chrome/JS/` folder.
3. Copy `style.css` into `chrome/userChrome.css` or import it from there.
4. Copy `preferences.json` if you want local reference for Sine-facing settings metadata.
5. Clear startup cache from `about:support`.
6. Restart Zen Browser.

## Notes on migration

- Existing `zen.notes.content`, `zen.notes.color`, and `zen.notes.lastEdited` data are preserved.
- v2 migrates legacy note content into the new `zen.notes.data` store.
- Failed migration should leave legacy prefs recoverable for debugging.

## Troubleshooting

### Widget does not appear

1. Confirm your loader is installed correctly.
2. Open Browser Console (`Ctrl+Shift+J`) and look for `[ZenNotes]` logs.
3. Clear startup cache and restart.
4. Verify `#TabsToolbar` and `#zen-sidebar-foot-buttons` still exist in your Zen build.

### Workspace switching does not isolate notes

Zen Notes v2 relies on Zen exposing a stable workspace identifier. If your Zen build changes that contract, note isolation may fail and v2 release should be blocked until the contract is revalidated.

### Need to reset v2 data

Delete or reset `zen.notes.data` and `zen.notes.schemaVersion` in `about:config`.

Legacy note prefs stay in:

- `zen.notes.content`
- `zen.notes.color`
- `zen.notes.lastEdited`
