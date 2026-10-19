# 0002 — Sine-only distribution, two channels

**Status:** accepted

**Context.** Hand-copying files into the profile conflicts with Sine, which also overwrites them.

**Decision.** Distribute only through Sine. `main` = stable, `beta` = prereleases. `scripts/bump.js` keeps `theme.json` `updatedAt` and channel `homepage` correct because Sine uses them to detect updates.

**Consequences.** Beta testers must install from the `beta` URL once. Never document or script manual profile installs.
