# Theming

All styling is in `src/style.css`, nested under `#zen-notes-widget`.

## Single source of truth

`PALETTES` in `src/zen-notes-core.uc.js` lists every palette as `[id, label, scheme]` (`scheme` is `light` or `dark`). `PRESETS`, `DEFAULT_PRESET`, `resolvePreset` and `schemeOf` derive from it. The UI sets `data-preset` and `data-scheme` on the widget; CSS maps `data-scheme` to `color-scheme` so links, scrollbars and focus rings match the palette. A test keeps `PALETTES`, `preferences.json` and the CSS blocks in agreement.

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

`sticky` (yellow paper, light) is the default palette (`DEFAULT_PRESET` in core, `preferences.json` default); `sticky-dark` is the amber variant. Both add a folded corner and a warmer shadow. Unknown or unset presets resolve to `sticky` (`resolvePreset`). There is no separate Appearance setting: the colour scheme dropdown is the only theme control.

## Adding a palette

1. Add `&[data-preset="your-palette"] { …five tokens… }` in the palettes section of `src/style.css`.
2. Add `[id, label, scheme]` to `PALETTES` in `src/zen-notes-core.uc.js` and a matching option in `preferences.json` (same order; a test enforces it).
3. Palettes must come from an established, permissively licensed scheme; credit it in the README attributions.

## Constraints

- No `@layer` (Zen's unlayered chrome CSS would win).
- Keep the sidebar safe: no layout that depends on `position: absolute` outside the card, `flex-shrink: 0` on the widget.
- Respect `prefers-reduced-motion`.
