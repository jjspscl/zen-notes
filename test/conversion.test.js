const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

function loadModel() {
  const { document } = parseHTML("<html><body></body></html>");
  const ns = {
    createId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`,
    createScratchElement: (tag) => document.createElement(tag),
    stripLegacyNamespaceAttrs: (html) => html.replace(/\s+xmlns(:[\w-]+)?\s*=\s*(["'])[^"']*\2/g, ""),
  };
  const source = fs.readFileSync(new URL("../zen-notes-model.uc.js", `file://${__filename}`), "utf8");
  vm.runInNewContext(source, { window: { ZenNotes: ns }, URL, Date, Math, Set, Array, Number, String, Boolean, JSON });
  return ns;
}

test("v4 note HTML migrates checklist children and inline marks", () => {
  const model = loadModel();
  const legacy = '<div>Title <b>bold</b> <a href="https://example.com">link</a></div><ol><li>one<ul><li>child</li></ul></li></ol><ul data-checklist="true"><li data-checked="false">todo</li></ul>';
  const blocks = model.htmlToBlocks(legacy);
  assert.deepEqual(JSON.parse(JSON.stringify(blocks.map(({ type, indent, checked }) => [type, indent, checked]))), [
    ["paragraph", 0, null], ["numbered", 0, null], ["bullet", 1, null], ["todo", 0, false],
  ]);
  const output = model.blocksToHTML(blocks);
  const restored = model.htmlToBlocks(output);
  assert.equal(model.getPlainText(restored[0]), "Title bold link");
  assert.equal(restored[0].text[1].b, true);
  assert.equal(restored[0].text[3].href, "https://example.com/");
  assert.equal(restored[3].type, "todo");
});

test("malicious and unsupported URLs are dropped during HTML conversion", () => {
  const model = loadModel();
  const [block] = model.htmlToBlocks('<p><a href="javascript:alert(1)">unsafe</a></p>');
  assert.equal(block.text[0].href, undefined);
  assert.doesNotMatch(model.blocksToHTML([block]), /javascript:/);
});

test("unknown HTML tags retain their text, unsafe markup does not survive export", () => {
  const model = loadModel();
  const [block] = model.htmlToBlocks('<custom-tag>preserved</custom-tag><script>alert(1)</script>');
  assert.equal(model.getPlainText(block), "preserved");
  assert.doesNotMatch(model.blocksToHTML([block]), /<script/i);
});
