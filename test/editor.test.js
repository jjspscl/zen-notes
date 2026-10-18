const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

function makeEditor() {
  const { document } = parseHTML("<html><body><div id='editor'></div></body></html>");
  const ns = {
    createId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`,
    createScratchElement: (tag) => document.createElement(tag),
    stripLegacyNamespaceAttrs: (html) => html,
  };
  for (const file of ["zen-notes-model.uc.js", "zen-notes-editor.uc.js"]) {
    const source = fs.readFileSync(new URL(`../${file}`, `file://${__filename}`), "utf8");
    vm.runInNewContext(source, { window: { ZenNotes: ns, prompt() { return ""; }, open() {} }, URL, Date, Math, Set, Array, Number, String, Boolean, JSON, CSS: { escape: (value) => value }, console, setTimeout, clearTimeout });
  }
  return { api: ns, editor: document.getElementById("editor") };
}

test("block editor renders and replaces block state without losing ids", () => {
  const { api, editor } = makeEditor();
  const first = api.createBlock("heading1", { id: "heading", text: [{ t: "Title", b: true }] });
  const apiInstance = api.createBlockEditor(editor, [first]);
  assert.equal(editor.children.length, 1);
  assert.equal(editor.firstElementChild.dataset.type, "heading1");
  assert.equal(editor.textContent, "Title");
  const next = api.createBlock("todo", { id: "task", checked: true, text: [{ t: "Task" }] });
  apiInstance.setBlocks([first, next]);
  assert.deepEqual(JSON.parse(JSON.stringify(apiInstance.getBlocks().map((block) => [block.id, block.type]))), [["heading", "heading1"], ["task", "todo"]]);
  assert.equal(editor.querySelector('[data-block-id="task"] .zen-notes-todo-control').getAttribute("aria-checked"), "true");
  apiInstance.cleanup();
});

test("indent and outdent carry child checkboxes as a subtree", () => {
  const { api, editor } = makeEditor();
  const parent = api.createBlock("todo", { id: "parent", text: [{ t: "Parent" }] });
  const child = api.createBlock("todo", { id: "child", checked: true, text: [{ t: "Child" }] });
  const grandchild = api.createBlock("bullet", { id: "grandchild", indent: 1, text: [{ t: "Grandchild" }] });
  const editorApi = api.createBlockEditor(editor, [parent, child, grandchild]);

  assert.equal(editorApi.indentBlock("child"), true);
  let blocks = editorApi.getBlocks();
  assert.deepEqual(blocks.map((block) => [block.id, block.type, block.indent]), [
    ["parent", "todo", 0], ["child", "todo", 1], ["grandchild", "bullet", 2],
  ]);
  assert.equal(blocks[1].checked, true);
  assert.equal(editor.querySelectorAll(".zen-notes-todo-control").length, 2);
  assert.equal(editor.querySelectorAll('[data-type="bullet"]').length, 1);

  assert.equal(editorApi.outdentBlock("child"), true);
  blocks = editorApi.getBlocks();
  assert.deepEqual(blocks.map((block) => [block.id, block.type, block.indent]), [
    ["parent", "todo", 0], ["child", "todo", 0], ["grandchild", "bullet", 1],
  ]);
  assert.equal(editor.querySelector('[data-block-id="child"] .zen-notes-todo-control').getAttribute("aria-checked"), "true");
  editorApi.cleanup();
});

test("keyboard shortcuts are attached to the widget, never the document", () => {
  const source = fs.readFileSync(new URL("../zen-notes-ui.uc.js", `file://${__filename}`), "utf8");
  const css = fs.readFileSync(new URL("../style.css", `file://${__filename}`), "utf8");
  assert.match(source, /widget\.addEventListener\("keydown", onWidgetKeydown\)/);
  assert.match(source, /if \(!widget\.contains\(document\.activeElement\)\) return/);
  assert.doesNotMatch(source, /document\.addEventListener\("keydown"/);
  assert.doesNotMatch(source, /execCommand\s*\(/);
  assert.match(css, /data-type="todo"\]::before \{ content: none; display: none; \}/);
});

function fakeSelection(document, range) {
  const view = document.defaultView;
  view.getSelection = () => ({ rangeCount: 1, isCollapsed: false, anchorNode: range.startContainer, getRangeAt: () => range, removeAllRanges() {}, addRange() {} });
}
function fakeRange(editor, sc, so, ec, eo) {
  const document = editor.ownerDocument;
  document.createRange = () => {
    const r = { startContainer: null, endContainer: null, selectNodeContents(n) { r.n = n; }, setEnd(c, o) { r.c = c; r.o = o; },
      toString() { const text = r.n.textContent; if (r.c === r.n) return text.slice(0, r.o === 0 ? 0 : text.length); return r.n.contains(r.c) ? (r.c.nodeValue || "").slice(0, r.o) + "" : text; } };
    return r;
  };
  return { startContainer: sc, startOffset: so, endContainer: ec, endOffset: eo };
}

test("typing over a select-all range replaces blocks and keeps block markup", () => {
  const { api, editor } = makeEditor();
  const blocks = [api.createBlock("paragraph", { id: "a", text: [{ t: "one" }] }), api.createBlock("heading1", { id: "b", text: [{ t: "two" }] })];
  const editorApi = api.createBlockEditor(editor, blocks);
  const document = editor.ownerDocument;
  fakeSelection(document, fakeRange(editor, editor, 0, editor, editor.children.length));
  let prevented = false;
  const event = new document.defaultView.Event("beforeinput", { bubbles: true, cancelable: true });
  Object.assign(event, { inputType: "insertText", data: "x" });
  event.preventDefault = () => { prevented = true; };
  editor.dispatchEvent(event);
  assert.equal(prevented, true);
  const result = editorApi.getBlocks();
  assert.equal(result.length, 1);
  assert.equal(editor.children.length, 1);
  assert.equal(editor.firstElementChild.dataset.blockId, result[0].id);
  assert.equal(editor.textContent, "x");
  editorApi.cleanup();
});

test("stray text left by the browser is folded back into a block", () => {
  const { api, editor } = makeEditor();
  const editorApi = api.createBlockEditor(editor, [api.createBlock("paragraph", { id: "a", text: [{ t: "one" }] })]);
  const document = editor.ownerDocument;
  editor.replaceChildren(document.createTextNode("raw text"));
  const event = new document.defaultView.Event("input", { bubbles: true });
  editor.dispatchEvent(event);
  assert.equal(editor.children.length, 1);
  assert.equal(editorApi.getBlocks()[0].text.map((run) => run.t).join(""), "raw text");
  editorApi.cleanup();
});

test("typing clears the empty-block placeholder flag", () => {
  const { api, editor } = makeEditor();
  const editorApi = api.createBlockEditor(editor, [api.createBlock("paragraph", { id: "a" })]);
  const row = editor.firstElementChild;
  assert.equal(row.dataset.empty, "true");
  const content = row.querySelector(".zen-notes-block-content");
  content.replaceChildren(editor.ownerDocument.createTextNode("hi"));
  const document = editor.ownerDocument;
  fakeSelection(document, fakeRange(editor, content.firstChild, 2, content.firstChild, 2));
  editor.ownerDocument.defaultView.getSelection = () => ({ rangeCount: 1, isCollapsed: true, anchorNode: content.firstChild, getRangeAt: () => ({ startContainer: content.firstChild, startOffset: 2, endContainer: content.firstChild, endOffset: 2, collapsed: true }) });
  editor.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  assert.equal(row.dataset.empty, undefined);
  editorApi.cleanup();
});
