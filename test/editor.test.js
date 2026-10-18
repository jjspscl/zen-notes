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
    vm.runInNewContext(source, { window: { ZenNotes: ns, prompt() { return ""; }, open() {} }, URL, Date, Math, Set, Array, Number, String, Boolean, JSON, CSS: { escape: (value) => value }, console });
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
