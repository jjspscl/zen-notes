# Theming

All styling is in `src/style.css`, nested under `#zen-notes-widget`.

## Tokens

Five colour tokens per palette, everything else is derived (`color-mix`, `light-dark`):

| Token | Role |
|---|---|
| `--zn-bg` | card background |
| `--zn-text` | ink |
| `--zn-border` | hairlines |
| `--zn-surface` | hover/callout/code background |
| `--zn-surface-strong` | pressed/active background |

Layout tokens: `--zn-space-1..3` (4/8/12px), `--zn-radius`, `--zn-control` (28px), `--zn-header` (36px), `--zn-ease`.

## Default: Sticky

`sticky` is the default palette (`DEFAULT_PRESET` in core, `preferences.json` default). It uses `light-dark()` so the **Appearance** setting (system/light/dark → `data-appearance`) switches paper colour. It adds a folded corner and a warmer shadow. Unknown or unset presets resolve to `sticky` (`resolvePreset`).

## Adding a palette

1. Add `&[data-preset="your-palette"] { …five tokens… }` in the palettes section of `src/style.css`.
2. Add the id to `PRESETS` in `src/zen-notes-core.uc.js` and an option in `preferences.json` (the order must match; a test enforces it).
3. Palettes must come from an established, permissively licensed scheme; credit it in the README attributions.

## Constraints

- No `@layer` (Zen's unlayered chrome CSS would win).
- Keep the sidebar safe: no layout that depends on `position: absolute` outside the card, `flex-shrink: 0` on the widget.
- Respect `prefers-reduced-motion`.
