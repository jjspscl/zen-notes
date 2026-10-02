const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const source = fs.readFileSync(new URL("../zen-notes-model.uc.js", `file://${__filename}`), "utf8");
function loadModel() {
  const { document } = parseHTML("<html><body></body></html>");
  const ns = {
    createId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`,
    createScratchElement: (tag) => document.createElement(tag),
    stripLegacyNamespaceAttrs: (html) => html.replace(/\s+xmlns(:[\w-]+)?\s*=\s*(["'])[^"']*\2/g, ""),
  };
  vm.runInNewContext(source, { window: { ZenNotes: ns }, URL, Date, Math, Set, Array, Number, String, Boolean, JSON });
  return ns;
}

test("creates normalized blocks and rejects unknown types", () => {
  const model = loadModel();
  const block = model.createBlock("nope", { indent: 99, text: [{ t: "hello", b: true }, { t: " world", b: true }] });
  assert.equal(block.type, "paragraph");
  assert.equal(block.indent, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(block.text)), [{ t: "hello world", b: true }]);
});

test("splits and merges rich text while retaining marks", () => {
  const model = loadModel();
  const block = model.createBlock("paragraph", { text: [{ t: "hello", b: true }, { t: " world" }] });
  const [left, right] = model.splitBlock(block, 7);
  assert.equal(model.getPlainText(left), "hello w");
  assert.equal(model.getPlainText(right), "orld");
  assert.equal(left.text[0].b, true);
  assert.equal(model.getPlainText(model.mergeBlocks(left, right)), "hello world");
});

test("changes block type and clamps indentation", () => {
  const model = loadModel();
  const block = model.createBlock("paragraph");
  assert.equal(model.indentBlock(block).indent, 1);
  assert.equal(model.outdentBlock(block).indent, 0);
  assert.equal(model.changeBlockType(block, "todo").checked, false);
  assert.equal(model.changeBlockType(block, "toggle").collapsed, false);
});

test("moves blocks with their contiguous descendants", () => {
  const model = loadModel();
  const blocks = [
    model.createBlock("bullet", { id: "a", text: [{ t: "A" }] }),
    model.createBlock("bullet", { id: "a-child", indent: 1, text: [{ t: "child" }] }),
    model.createBlock("bullet", { id: "b", text: [{ t: "B" }] }),
  ];
  assert.deepEqual(model.moveBlock(blocks, "a", "down").map((block) => block.id), ["b", "a", "a-child"]);
});

test("marks and safe links affect only the requested range", () => {
  const model = loadModel();
  const block = model.createBlock("paragraph", { text: [{ t: "hello world" }] });
  const bold = model.applyMark(block, { start: 0, end: 5 }, "b");
  assert.deepEqual(JSON.parse(JSON.stringify(bold.text)), [{ t: "hello", b: true }, { t: " world" }]);
  const linked = model.setLink(bold, { start: 6, end: 11 }, "https://example.com");
  assert.equal(linked.text[2].href, "https://example.com/");
  const blocked = model.setLink(block, { start: 0, end: 5 }, "javascript:alert(1)");
  assert.equal(blocked.text[0].href, undefined);
});

test("imports nested lists and inline formatting; exports safe v4 HTML", () => {
  const model = loadModel();
  const blocks = model.htmlToBlocks('<div>Hi <strong>there</strong></div><ul data-checklist="true"><li data-checked="true">A<ul><li>B</li></ul></li></ul>');
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[0].text[1].b, true);
  assert.equal(blocks[1].type, "todo");
  assert.equal(blocks[1].checked, true);
  assert.equal(blocks[2].indent, 1);
  const html = model.blocksToHTML(blocks);
  assert.match(html, /<strong>there<\/strong>/);
  assert.match(html, /data-checklist="true"/);
});

test("validates ids, types, indentation and required todo state", () => {
  const model = loadModel();
  const valid = model.createBlock("todo", { id: "todo", checked: true });
  assert.equal(model.validateBlocks([valid]).valid, true);
  const invalid = { id: "todo", type: "unknown", indent: 8, text: [], checked: "yes" };
  assert.equal(model.validateBlocks([valid, invalid]).valid, false);
});
