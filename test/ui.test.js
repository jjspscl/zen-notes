const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadCore() {
  const window = {};
  const source = fs.readFileSync(new URL("../zen-notes-core.uc.js", `file://${__filename}`), "utf8");
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
