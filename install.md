# Installation Guide

## Preferred path: Sine

Zen Notes v2 ships Sine-first metadata:

- `theme.json` at repo root
- Sine UI controls in `preferences.json`
- root `notes-widget.uc.js` and `style.css`

Zen Notes is Sine-ready. Until the marketplace listing is accepted, install it in [Sine](https://github.com/CosmoCreeper/Sine) as an unpublished/custom mod from `https://github.com/jjspscl/zen-notes`.

After marketplace acceptance, install stable releases from the Sine marketplace.

## Release channels

### Stable channel

- Branch: `main`
- Versions: normal SemVer, for example `2.0.0` or `2.1.0`
- Tags: `vX.Y.Z`
- Audience: normal users and Sine marketplace installs

### Beta channel

- Branch: `beta`
- Versions: prerelease SemVer, for example `2.1.0-beta.1`
- Tags: `vX.Y.Z-beta.N`
- Audience: testers only
- Behavior: beta uses the same mod ID (`zen-notes`) and preferences as stable, so installing beta replaces the stable install for that profile.

Beta builds may include forward-only storage migrations. Do not use beta as a side-by-side install with stable.

## Local development / manual testing

Manual testing can still use a `userChrome.js` loader when developing outside Sine.

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
- v2 migrates legacy note content into the schema v3 `zen.notes.data` store.
- Failed migration should leave legacy prefs recoverable for debugging.

## Troubleshooting

### Widget does not appear

1. Confirm your loader is installed correctly.
2. Open Browser Console (`Ctrl+Shift+J`) and look for `[ZenNotes]` logs.
3. Clear startup cache and restart.
4. Verify `#TabsToolbar` and `#zen-sidebar-foot-buttons` still exist in your Zen build.

### Workspace switching does not pin the expected note

Zen Notes v2 relies on Zen exposing a stable workspace identifier. If your Zen build changes that contract, each workspace may pin the wrong active note until the selector logic is updated.

### Need to reset v2 data

Delete or reset `zen.notes.data` and `zen.notes.schemaVersion` in `about:config`.

Legacy note prefs stay in:

- `zen.notes.content`
- `zen.notes.color`
- `zen.notes.lastEdited`
