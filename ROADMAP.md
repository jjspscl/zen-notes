# Zen Notes — Roadmap

Current: **v2.5.0-beta.9** — sticky-note theme, block editor, atomic file storage, modernized tooling and layout. Becomes 2.5.0 stable once validated in Zen.

## 2.5.0 stable (next)
- [ ] Validate in Zen via Sine: restart persistence, v4 migration, multi-window sync, newer-schema read-only
- [ ] Verify IME, select-all/replace, cross-block editing, all block types
- [ ] Tag `v2.5.0` from `main` (`homepage` returns to the plain repo URL)

## 2.6 (planned)
- [ ] Remove the v4 preference mirror (`zen.notes.data`) used for 2.4.x rollback
- [ ] Evaluate `.uc.mjs` ES modules once Sine exposes a stable unload contract for them
- [ ] Sine store listing (`sineorg/store`)

## Done in 2.5
- [x] Flat block model (schema v5) and legacy HTML migration
- [x] Atomic `notes.json` with backups, lock and revision checks
- [x] Sticky default palette; unused workspace/colour features removed
- [x] `src/` layout, Biome, consolidated validator, partial re-rendering, idle start

## Release channels
See [docs/release.md](docs/release.md).
