# 0003 — Sticky note as the default theme

**Status:** accepted (2.5)

**Context.** The previous default (Catppuccin) looked like a generic dark card and ignored the "notes" identity.

**Decision.** Add a `sticky` palette using `light-dark()` (yellow paper in light, warm amber in dark) as the default; keep the 15 existing palettes. Remove the old per-note colour and workspace features.

**Consequences.** Users with a saved palette keep it. Unknown palettes fall back to sticky.
