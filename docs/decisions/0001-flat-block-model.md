# 0001 — Flat block model

**Status:** accepted (2.5)

**Context.** The 2.4 editor stored HTML and relied on `execCommand`, which broke list and checklist behaviour across Firefox versions and XHTML chrome documents.

**Decision.** Store one note as a flat `blocks[]` with an `indent` level (0–5) for children. All edits are pure model operations; the DOM is rendered from the model.

**Consequences.** Predictable undo, safe serialization, simple migration from HTML. Nested structures beyond 5 levels are flattened.
