const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadCore() {
  const window = {};
  const source = fs.readFileSync(new URL("../src/zen-notes-core.uc.js", `file://${__filename}`), "utf8");
  vm.runInNewContext(source, { window, Date, Math, JSON, console, Services: undefined });
  return window.ZenNotes;
}

test("footer meta combines edited date and word count", () => {
  const { formatFooterMeta } = loadCore();
  assert.equal(formatFooterMeta("19 Oct 2026", "hello there world"), "Edited 19 Oct 2026 · 3 words");
  assert.equal(formatFooterMeta("19 Oct 2026", "one"), "Edited 19 Oct 2026 · 1 word");
  assert.equal(formatFooterMeta("19 Oct 2026", "   "), "Edited 19 Oct 2026");
  assert.equal(formatFooterMeta("", ""), "");
});

test("sticky is the default preset and unknown presets fall back to it", () => {
  const { resolvePreset, DEFAULT_PRESET, PRESETS } = loadCore();
  assert.equal(DEFAULT_PRESET, "sticky");
  assert.equal(PRESETS[0], "sticky");
  assert.equal(resolvePreset(""), "sticky");
  assert.equal(resolvePreset("nope"), "sticky");
  assert.equal(resolvePreset("nord"), "nord");
});

test("every preset in the stylesheet exists in the preset list and preferences", () => {
  const { PRESETS } = loadCore();
  const css = fs.readFileSync(new URL("../src/style.css", `file://${__filename}`), "utf8");
  const prefs = JSON.parse(fs.readFileSync(new URL("../preferences.json", `file://${__filename}`), "utf8"));
  const dropdown = prefs.find((item) => item.property === "zen.notes.preset");
  assert.equal(dropdown.defaultValue, "sticky");
  assert.deepEqual(
    dropdown.options.map((option) => option.value),
    [...PRESETS],
  );
  for (const preset of PRESETS.filter((name) => name !== "sticky")) {
    assert.ok(css.includes(`[data-preset="${preset}"]`), `missing palette for ${preset}`);
  }
});

test("deprecated preferences are cleared once and others are kept", () => {
  const cleared = [];
  const window = {};
  const source = fs.readFileSync(new URL("../src/zen-notes-core.uc.js", `file://${__filename}`), "utf8");
  const services = {
    prefs: { prefHasUserValue: (key) => key !== "zen.notes.color", clearUserPref: (key) => cleared.push(key) },
  };
  vm.runInNewContext(source, { window, Date, Math, JSON, console, Services: services });
  window.ZenNotes.cleanupDeprecatedPrefs();
  assert.deepEqual(cleared.sort(), [
    "zen.notes.debugKeyNav",
    "zen.notes.defaultColor",
    "zen.notes.lastEdited",
    "zen.notes.showWorkspaceKey",
  ]);
});

test("empty-block hints: the general hint wins on a one-block note", () => {
  const css = fs.readFileSync(new URL("../src/style.css", `file://${__filename}`), "utf8");
  assert.match(css, /data-type\^="heading"\]:not\(:only-child\)/);
  assert.match(css, /data-type="todo"\]:not\(:only-child\)/);
});
