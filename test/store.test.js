const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

function harness(prefData = "", disableIO = false) {
  const { document } = parseHTML("<html><body></body></html>");
  const files = new Map(); const strings = new Map([["zen.notes.data", prefData]]); const observers = [];
  const ns = {
    SCHEMA_VERSION: 5, PREF_DATA: "zen.notes.data", PREF_DATA_BACKUP: "zen.notes.dataBackup", DEFAULT_WORKSPACE_ID: "global-default",
    createId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`,
    createNote: (title) => ({ id: "note-test", title, color: "yellow", contentHTML: "", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" }),
    nowISOString: () => "2026-10-02T00:00:00.000Z",
    getPrefString: (key, fallback = "") => strings.has(key) ? strings.get(key) : fallback,
    setPrefString: (key, value) => strings.set(key, value),
    createScratchElement: (tag) => document.createElement(tag),
    stripLegacyNamespaceAttrs: (html) => html,
  };
  const code = fs.readFileSync(new URL("../zen-notes-model.uc.js", `file://${__filename}`), "utf8");
  const storeCode = fs.readFileSync(new URL("../zen-notes-store.uc.js", `file://${__filename}`), "utf8");
  const context = {
    window: { ZenNotes: ns }, URL, Date, Math, Set, Array, Number, String, Boolean, JSON, console,
    PathUtils: { profileDir: "/profile", join: (...parts) => parts.join("/") },
    IOUtils: {
      async makeDirectory() {}, async exists(path) { return files.has(path); },
      async readJSON(path) { if (!files.has(path)) throw new Error("missing"); return JSON.parse(files.get(path)); },
      async writeJSON(path, value) { files.set(path, JSON.stringify(value)); },
      async writeUTF8(path, text, options = {}) { if (options.mode === "create" && files.has(path)) throw new Error("already exists"); files.set(path, text); },
      async readUTF8(path) { if (!files.has(path)) throw new Error("missing"); return files.get(path); },
      async getChildren(dir) { return [...files.keys()].filter((path) => path.startsWith(dir)); },
      async remove(path) { files.delete(path); },
    },
    Services: {
      prefs: { getStringPref: (key, fallback = "") => strings.has(key) ? strings.get(key) : fallback, setStringPref: (key, value) => strings.set(key, value), setIntPref() {} },
      obs: { addObserver(observer, topic) { observers.push({ observer, topic }); }, removeObserver() {}, notifyObservers(_subject, topic, data) { observers.filter((entry) => entry.topic === topic).forEach((entry) => entry.observer.observe(null, topic, data)); } },
    },
  };
  if (disableIO) { context.IOUtils = undefined; context.PathUtils = undefined; }
  vm.runInNewContext(code, context); vm.runInNewContext(storeCode, context);
  return { api: ns, files, strings };
}

test("migrates v4 preference content into a v5 file and keeps legacy copy", async () => {
  const legacy = JSON.stringify({ version: 4, note: { id: "old", title: "Migrated", contentHTML: "<div>keep me</div>", color: "blue" } });
  const { api, files, strings } = harness(legacy);
  const state = await api.storeLoad();
  assert.equal(state.schemaVersion, 5);
  assert.equal(state.note.title, "Migrated");
  assert.equal(api.getPlainText(state.note.blocks[0]), "keep me");
  assert.ok([...files.keys()].some((path) => path.endsWith("notes.json")));
  assert.ok([...files.keys()].some((path) => path.endsWith("notes.legacy-v4.json")));
  assert.equal(JSON.parse(strings.get("zen.notes.data")).version, 4);
});

test("saves atomically, mirrors v4 state, and notifies subscribers", async () => {
  const { api, files, strings } = harness();
  const state = await api.storeLoad();
  let notified = 0; const stop = api.storeSubscribe(() => notified++);
  state.note.blocks = [api.createBlock("paragraph", { text: [{ t: "saved" }] })];
  await api.storeSave(state);
  const saved = JSON.parse(files.get("/profile/zen-notes/notes.json"));
  assert.equal(saved.schemaVersion, 5);
  assert.equal(api.getPlainText(saved.note.blocks[0]), "saved");
  assert.equal(JSON.parse(strings.get("zen.notes.data")).version, 4);
  assert.equal(notified, 0, "local writes must not trigger a second-window reload in the same window");
  stop();
});

test("newer schema opens read-only and is not overwritten", async () => {
  const { api, files } = harness();
  files.set("/profile/zen-notes/notes.json", JSON.stringify({ schemaVersion: 99, note: { blocks: [] } }));
  const state = await api.storeLoad();
  assert.equal(state.readOnly, true);
  assert.equal(state.readOnlyReason, "newer-schema");
  await assert.rejects(api.storeSave(state), /read-only/);
});

test("rejects stale cross-window writes instead of silently clobbering newer content", async () => {
  const { api } = harness();
  const original = await api.storeLoad();
  const stale = JSON.parse(JSON.stringify(original));
  const winner = JSON.parse(JSON.stringify(original));
  winner.note.blocks = [api.createBlock("paragraph", { text: [{ t: "newer" }] })];
  await api.storeSave(winner);
  stale.note.blocks = [api.createBlock("paragraph", { text: [{ t: "stale" }] })];
  await assert.rejects(api.storeSave(stale), /changed in another window/);
});

test("preserves a corrupt data file before rebuilding from the v4 mirror", async () => {
  const mirror = JSON.stringify({ version: 4, note: { id: "old", contentHTML: "<div>recovered</div>" } });
  const { api, files } = harness(mirror);
  files.set("/profile/zen-notes/notes.json", "{broken");
  const state = await api.storeLoad();
  assert.equal(api.getPlainText(state.note.blocks[0]), "recovered");
  assert.ok([...files.keys()].some((path) => /notes\.corrupt-.*\.json$/.test(path)));
  assert.equal(JSON.parse(files.get("/profile/zen-notes/notes.json")).schemaVersion, 5);
});

test("preference-only fallback retains full v5 blocks when IOUtils is unavailable", async () => {
  const { api, strings } = harness("", true);
  const state = await api.storeLoad();
  state.note.blocks = [api.createBlock("heading2", { text: [{ t: "fallback" }] })];
  await api.storeSave(state);
  const reloaded = await api.storeLoad();
  assert.equal(reloaded.note.blocks[0].type, "heading2");
  assert.equal(api.getPlainText(reloaded.note.blocks[0]), "fallback");
  assert.equal(JSON.parse(strings.get("zen.notes.data")).version, 4);
});
