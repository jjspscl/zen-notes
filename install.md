# Installation Guide

## Preferred path: Sine

Zen Notes v2 ships Sine-first metadata:

- `theme.json` at repo root
- Sine UI controls in `preferences.json`
- root `zen-notes-core.uc.js`, `zen-notes-editor.uc.js`, `zen-notes-ui.uc.js`, and `style.css`

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

Test changes by loading the mod locally in Sine.

### Load from source

1. Clone the repository.
2. In Sine settings, add the cloned folder as an unpublished/custom mod.
3. Clear startup cache from `about:support`.
4. Restart Zen Browser.

To build a release ZIP for testing: `node scripts/build-release.js` and install the resulting ZIP via Sine → Install from file.

## Notes on migration

- Existing `zen.notes.content`, `zen.notes.color`, and `zen.notes.lastEdited` data are preserved.
- v2 migrates legacy note content into the schema v3 `zen.notes.data` store.
- Failed migration should leave legacy prefs recoverable for debugging.

## Troubleshooting

### Widget does not appear

1. Confirm Sine is installed and the mod is enabled.
2. Open Browser Console (`Ctrl+Shift+J`) and look for `[ZenNotes]` logs.
3. Clear startup cache and restart.
4. Reinstall the mod ZIP in Sine if files changed.
5. Verify `#TabsToolbar` and `#zen-sidebar-foot-buttons` still exist in your Zen build.

### Workspace switching does not pin the expected note

Zen Notes v2 relies on Zen exposing a stable workspace identifier. If your Zen build changes that contract, each workspace may pin the wrong active note until the selector logic is updated.

### Need to reset v2 data

Delete or reset `zen.notes.data` and `zen.notes.schemaVersion` in `about:config`.

Legacy note prefs stay in:

- `zen.notes.content`
- `zen.notes.color`
- `zen.notes.lastEdited`
