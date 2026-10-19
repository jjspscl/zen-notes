# 0003 — Sticky note as the default theme

**Status:** accepted (2.5)

**Context.** The previous default (Catppuccin) looked like a generic dark card and ignored the "notes" identity.

**Decision.** Add a light `sticky` palette (yellow paper) as the default and a `sticky-dark` amber variant; keep the 15 existing palettes. Palettes are defined once in `PALETTES` and the colour scheme dropdown is the only theme control (no Appearance setting). Remove the old per-note colour and workspace features.

**Consequences.** Users with a saved palette keep it. Unknown palettes fall back to sticky.
