# Zen Notes — Roadmap

Current: **v2.5.0** — stable block editor with the sticky-note theme, atomic file storage, modernized tooling and layout.

## 2.5.0 stable
- [x] Validated in Zen via Sine: persistence, select-all/replace, block types, slash menu, backspace behaviour
- [x] Released from `main`; `homepage` is the plain repo URL

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
