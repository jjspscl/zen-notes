# Installing Zen Notes

Zen Notes is installed and updated by [Sine](https://github.com/CosmoCreeper/Sine) (Zen Browser mod manager). Requires Zen 1.7+.

## Install

1. Open Zen → **Settings → Sine Mods**.
2. Add a mod from GitHub and paste the source for your channel:
   - Stable: `https://github.com/jjspscl/zen-notes`
   - Beta: `https://github.com/jjspscl/zen-notes/tree/beta`
3. Restart Zen.

Sine updates mods when the browser starts, or on demand: **Settings → Sine Mods → Zen Notes → Update**.

## Channels

| Channel | Branch | Version | Audience |
|---|---|---|---|
| Stable | `main` | `X.Y.Z` | everyone |
| Beta | `beta` | `X.Y.Z-beta.N` | testers |

Both use the same mod id (`zen-notes`) and preferences, so installing one replaces the other. Beta storage changes can be forward-only; back up `<profile>/zen-notes/notes.json` before switching.

## Do not copy files by hand

Sine owns `<profile>/chrome/sine-mods/`. Hand-copied files conflict with Sine and are overwritten on update. Leftovers from pre-Sine installs (`chrome/userChrome.css` with `#zen-notes-widget` rules, `chrome/JS/notes-widget.uc.js`, `chrome/CSS/zen-notes.uc.css`) should be deleted; they can restyle or duplicate the widget.

## Where your note lives

`<profile>/zen-notes/notes.json` (plus rolling `notes.backup-*.json`). Uninstalling the mod does not delete it. See [docs/storage.md](docs/storage.md).

## Troubleshooting

- **Widget missing** — confirm the mod is enabled in Sine; open the Browser Console (`Ctrl+Shift+J`) and look for `[ZenNotes]`.
- **Update not offered** — Sine compares `updatedAt` in `theme.json` and reads from the branch in `homepage`; for betas it must be the `beta` branch (reinstall from the beta URL once).
- **Wrong colours** — pick a palette in the mod's Sine settings; default is Sticky.
