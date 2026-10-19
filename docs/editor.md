# Editor internals

`src/zen-notes-editor.uc.js` implements a block editor over a `contenteditable` host. The model, not the DOM, is the source of truth.

## Rules

- **No `execCommand`.** Structural edits (split, merge, indent, move, type change, formatting) are pure functions in the model followed by `mutate()` → `render()`.
- **Selections map to model points** `{ blockId, offset }` (`pointFromBoundary`). Boundaries on the editor itself or on a block row (what Ctrl+A produces) snap to the start/end of the nearest block.
- **The browser never edits over a selection.** `beforeinput` replaces any non-collapsed selection through the model (`deleteSelection(event, text)`); Enter deletes the selection first; paste is handled by `onPaste`.
- **Plain typing** is allowed to touch the DOM; `input` re-reads the block (`syncBlockFromDOM`) and updates `data-empty`. If stray nodes appear outside block rows, `repairStrayDOM()` folds them back into a block.
- **IME**: no model updates while composing; one sync on `compositionend`.
- **Arrow keys**: the editor keeps its caret-navigation guard so Zen's sidebar shortcuts do not steal Arrow/Home/End/Page keys.
- **Scoped shortcuts**: key handlers live on the editor/widget, never on `document`.

## Rendering

`render()` reconciles `blocksState` with the DOM and reuses rows whose block object identity is unchanged (`rendered` map). `syncBlockFromDOM` records the new object for the typed row so typing never re-renders it.

## History

Custom snapshot stack (`history[]`, max 200 `JSON` snapshots); typing coalesces for 500 ms; structural operations commit before and after.

## Empty-block hints

CSS only: `data-empty="true"` rows show "Type / for commands…", "Heading" or "To-do" via `::before`, hidden while the editor has focus.
