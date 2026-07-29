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

Sine installs mods from GitHub only. There is no local-folder or ZIP install
path: Sine's importer takes a `mods.json` list and re-downloads each entry from
its `homepage`, so a locally built ZIP cannot be handed to it.

That leaves two ways to test unreleased changes. Neither needs a tag or a
release — Sine fetches a branch archive, not a release asset.

### Option 1: install from a branch

Paste the repository into the custom-mod input in Sine settings, next to the
marketplace. `theme.json` sits at the repository root, so no subfolder is needed:

```
jjspscl/zen-notes
jjspscl/zen-notes/tree/<branch>
```

Sine downloads that branch as an archive, so pushing to a working branch is
enough to test. Requires `sine.allow-unsafe-js` — Sine only loads scripts when
`allowUnsafeJS` is set or the mod came from the official store, and a custom
install is not store origin.

The mod does **not** have to come from the Sine store. The store is one origin
among several; a custom repository install is equally supported.

### Option 2: edit the installed mod folder in place

Faster, no push per change.

1. Install once via Option 1. This is required, not a convenience: Sine
   enumerates mods from its `mods.json` registry, not from the contents of
   `sine-mods/`. Without a `zen-notes` entry the scripts are never collected and
   `style.css` is never added to the generated `chrome.css`, so hand-placed files
   do nothing. Installing also overwrites the folder from the branch archive, so
   copy local edits back in afterward.
2. Turn **off** auto-update for Zen Notes in Sine settings. This sets
   `no-updates: true` and stops Sine overwriting local edits on browser start.
3. Edit the files under `<profile>/chrome/sine-mods/zen-notes/`.
4. Reload without restarting Zen. Any of these run the same
   `manager.rebuildMods()`, which reloads CSS *and* re-executes the JS from disk:

   - **Toggle the mod off and on** in Sine settings. Most reliable, no setup.
     Zen Notes sets `supportsUnload: true`, so this unloads cleanly.
   - **Toggle "disable all mods"** off and on in Sine settings.
   - **Dev command palette**: enable `sine.enable-dev`, then press
     **Ctrl+Shift+Y** → **Refresh mod styles**.

Sine hardcodes Ctrl+Shift+Y with no remap pref, and browser extensions claim
their shortcuts ahead of Sine's document listener — Bitwarden uses that exact
combo by default. If the palette does not appear, an extension has taken the
binding. Rebind or remove it at `about:addons` → gear → **Manage Extension
Shortcuts**, or just use the mod toggle instead.

Keep the repository authoritative and copy edits back, or generate the mod
folder from a checkout so the files you edit are the files you commit.

Symlinking the mod folder at a checkout works on native Linux and macOS. It does
**not** work from WSL into a Windows Zen profile: ext4 symlinks are unreadable
by Windows, directory junctions cannot target `\\wsl.localhost`, and `mklink /D`
to a UNC path needs elevation or Developer Mode. Copy or sync instead.

`node scripts/build-release.js` builds the release archive for GitHub Releases.
It is not an install path.

## Notes on migration

- Existing `zen.notes.content`, `zen.notes.color`, and `zen.notes.lastEdited` data are preserved.
- v2 migrates legacy note content into the schema v3 `zen.notes.data` store.
- Failed migration should leave legacy prefs recoverable for debugging.

## Troubleshooting

### Widget does not appear

1. Confirm Sine is installed and the mod is enabled.
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
