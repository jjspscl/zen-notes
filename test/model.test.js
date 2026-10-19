const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const source = fs.readFileSync(new URL("../src/zen-notes-model.uc.js", `file://${__filename}`), "utf8");
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
  const block = model.createBlock("nope", {
    indent: 99,
    text: [
      { t: "hello", b: true },
      { t: " world", b: true },
    ],
  });
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
  assert.deepEqual(
    model.moveBlock(blocks, "a", "down").map((block) => block.id),
    ["b", "a", "a-child"],
  );
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
  const blocks = model.htmlToBlocks(
    '<div>Hi <strong>there</strong></div><ul data-checklist="true"><li data-checked="true">A<ul><li>B</li></ul></li></ul>',
  );
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

test("Enter at the end of a heading continues with a paragraph; mid-heading keeps headings", () => {
  const api = loadModel();
  const heading = api.createBlock("heading2", { id: "h", text: [{ t: "Title" }] });
  const [left, right] = api.splitOnEnter(heading, 5);
  assert.equal(left.type, "heading2");
  assert.equal(right.type, "paragraph");
  const [a, b] = api.splitOnEnter(heading, 2);
  assert.equal(a.type, "heading2");
  assert.equal(b.type, "heading2");
});

test("scrollDeltaForCaret keeps the caret clear of the bottom fade", () => {
  const api = loadModel();
  const box = { top: 100, bottom: 300 };
  assert.equal(api.scrollDeltaForCaret({ top: 150, bottom: 170 }, box, 32), 0);
  assert.equal(api.scrollDeltaForCaret({ top: 260, bottom: 280 }, box, 32), 12);
  assert.equal(api.scrollDeltaForCaret({ top: 80, bottom: 98 }, box, 32), -20);
});

test("Backspace at the start: empty paragraph after a heading puts the caret at the heading end", () => {
  const api = loadModel();
  const heading = api.createBlock("heading1", { id: "h", text: [{ t: "Title" }] });
  const empty = api.createBlock("paragraph", { id: "p" });
  const result = api.backspaceAtStart([heading, empty], 1);
  assert.deepEqual(
    result.blocks.map((b) => [b.id, b.type]),
    [["h", "heading1"]],
  );
  assert.deepEqual({ ...result.caret }, { blockId: "h", offset: 5 });
});

test("Backspace at the start: text merges into the block above, keeping its type", () => {
  const api = loadModel();
  const heading = api.createBlock("heading2", { id: "h", text: [{ t: "Head" }] });
  const para = api.createBlock("paragraph", { id: "p", text: [{ t: "tail" }] });
  const result = api.backspaceAtStart([heading, para], 1);
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].type, "heading2");
  assert.equal(api.getPlainText(result.blocks[0]), "Headtail");
  assert.equal(result.caret.offset, 4);
});

test("Backspace at the start: nested and typed blocks step down before merging", () => {
  const api = loadModel();
  const para = api.createBlock("paragraph", { id: "a", text: [{ t: "a" }] });
  const nested = api.createBlock("bullet", { id: "b", indent: 1, text: [{ t: "b" }] });
  let result = api.backspaceAtStart([para, nested], 1);
  assert.equal(result.blocks[1].indent, 0);
  assert.equal(result.blocks[1].type, "bullet");
  result = api.backspaceAtStart(result.blocks, 1);
  assert.equal(result.blocks[1].type, "paragraph");
  result = api.backspaceAtStart(result.blocks, 1);
  assert.equal(result.blocks.length, 1);
  assert.equal(api.backspaceAtStart(result.blocks, 0), null);
});

test("Backspace removes a divider above and delete-forward merges the next block", () => {
  const api = loadModel();
  const a = api.createBlock("paragraph", { id: "a", text: [{ t: "a" }] });
  const rule = api.createBlock("divider", { id: "d" });
  const b = api.createBlock("paragraph", { id: "b", text: [{ t: "b" }] });
  const gone = api.backspaceAtStart([a, rule, b], 2);
  assert.deepEqual(
    gone.blocks.map((x) => x.id),
    ["a", "b"],
  );
  const merged = api.deleteForwardAtEnd([a, b], 0);
  assert.equal(api.getPlainText(merged.blocks[0]), "ab");
  assert.equal(merged.caret.offset, 1);
  assert.equal(api.deleteForwardAtEnd([a], 0), null);
});

test("placeMenu opens below, flips above near the bottom, and stays inside the viewport", () => {
  const api = loadModel();
  const viewport = { width: 400, height: 600 };
  const size = { width: 160, height: 220 };
  const below = api.placeMenu({ left: 50, top: 100, bottom: 118 }, size, viewport);
  assert.equal(below.placement, "below");
  assert.equal(below.top, 122);
  const above = api.placeMenu({ left: 50, top: 520, bottom: 538 }, size, viewport);
  assert.equal(above.placement, "above");
  assert.equal(above.top, 520 - 4 - 220);
  const edge = api.placeMenu({ left: 390, top: 100, bottom: 118 }, size, viewport);
  assert.equal(edge.left, 400 - 160 - 8);
  const tight = api.placeMenu(
    { left: 10, top: 150, bottom: 168 },
    { width: 160, height: 400 },
    { width: 400, height: 320 },
  );
  assert.ok(tight.maxHeight <= 320);
  assert.ok(tight.top >= 0);
});
