# Storage

## Primary file

`<profile>/zen-notes/notes.json`, schema **v5**:

```json
{
  "schemaVersion": 5,
  "revision": 1792367387000,
  "savedAt": "2026-10-19T00:00:00.000Z",
  "note": {
    "id": "note-…", "title": "Zen Notes", "createdAt": "…", "updatedAt": "…",
    "blocks": [ { "id": "block-…", "type": "paragraph", "indent": 0, "text": [ { "t": "Hello", "b": true } ] } ]
  }
}
```

- `blocks[]` is flat. Nesting is `indent` (0–5) on list/to-do blocks.
- Block `type`: `paragraph`, `heading1-3`, `bullet`, `numbered`, `todo` (`checked`), `toggle` (`collapsed`), `quote`, `callout`, `divider`, `code` (`lang`).
- `text` is a list of runs `{ t, b, i, u, s, c, href }` (bold, italic, underline, strike, code, safe link).

## Writing

`IOUtils.writeJSON` with a temporary path, under a cross-window lock file (`notes.lock`, stale after 15 s). A save is rejected if the on-disk `revision` is newer than the writer's: the edits stay in memory, the UI shows an error and a `notes.conflict-*.json` recovery copy is attempted. Rolling backups (`notes.backup-*.json`, last 5) are taken before each overwrite; `notes.previous.json` is the last file version.

## Reading and migration

1. Read `notes.json`. A newer `schemaVersion` opens **read-only**. A corrupt file is copied to `notes.corrupt-*.json` before recovery.
2. If absent, migrate the legacy preference `zen.notes.data` (v4 HTML, with nested lists and checklists) or `zen.notes.content` (v1) into blocks. The raw source is preserved in `notes.legacy-v4.json` and `zen.notes.dataBackup`.
3. If `IOUtils` is unavailable, the whole v5 state is kept in `zen.notes.dataV5Fallback`.

## Deprecated: v4 mirror

Every successful save also writes v4 HTML to `zen.notes.data` so a downgrade to 2.4.x still shows the note. This is **deprecated and scheduled for removal in 2.6**. Removed-feature preferences (`showWorkspaceKey`, `defaultColor`, `debugKeyNav`, `color`, `lastEdited`) are cleared at startup.
