# 0004 — Classic `.uc.js` scripts, not ES modules (yet)

**Status:** accepted, revisit in 2.6

**Context.** Sine can also load `.uc.mjs` (dynamic `import()`), but its unload contract differs and the 2.3.x engine in the wild varies.

**Decision.** Keep five classic `.uc.js` files sharing `window.ZenNotes`, moved under `src/` (Sine supports nested script paths). Gain performance through idle initialization and partial rendering rather than a new loader.

**Consequences.** No `import`/`export`; tests execute sources in a `vm` context.
