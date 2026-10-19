# Releasing

## Channels

| | Stable | Beta |
|---|---|---|
| Branch | `main` | `beta` |
| Version | `X.Y.Z` | `X.Y.Z-beta.N` |
| Tag | `vX.Y.Z` | `vX.Y.Z-beta.N` (GitHub prerelease) |
| `theme.json` `homepage` | `https://github.com/jjspscl/zen-notes` | `https://github.com/jjspscl/zen-notes/tree/beta` |

Beta and stable share the mod id and preferences; installing one replaces the other in a profile.

## Steps

```bash
npm run check                          # biome + validate + tests
node scripts/bump.js 2.5.0-beta.7      # or patch|minor|major|x.y.z
# edit CHANGELOG.md
npm run check
git add -A && git commit -m "chore: release v2.5.0-beta.7"
git branch -f beta HEAD                # beta releases only
git tag v2.5.0-beta.7
git push origin <branch> beta v2.5.0-beta.7
```

`bump.js` updates: `theme.json` (version, `updatedAt` to now, channel `homepage`), `mod.json`, `package.json`, `package-lock.json`, each script's `@version` and `VERSION`, the README badge and the ROADMAP header. `scripts/validate.js` fails CI if any of them disagree, or if `homepage` does not match the channel, or `updatedAt` is not an ISO timestamp.

## Why `updatedAt` and `homepage` matter

Sine installs from `homepage`'s branch and only offers an update when the remote `updatedAt` is newer than the installed one. A stale date or a `main` homepage on a beta means testers never see the update.

## CI

- `ci.yml`: `npm ci && npm run check` on push/PR.
- `release.yml`: on `v*` tags, checks tag = `theme.json` version, runs `npm run check`, builds the zip (`scripts/build-release.js`: only `src/` runtime files plus Sine metadata and docs) and publishes a GitHub release; versions with a hyphen are marked prerelease.

## Promoting beta to stable

Merge the branch into `main`, run `node scripts/bump.js 2.5.0` (resets `homepage` to the plain URL), update CHANGELOG/ROADMAP, tag `v2.5.0`.
