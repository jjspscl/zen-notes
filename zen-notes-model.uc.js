// ==UserScript==
// @name            Zen Notes Model
// @version         2.5.0-beta.5
// @description     Block document model and HTML migration helpers for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  const TYPES = ["paragraph", "heading1", "heading2", "heading3", "bullet", "numbered", "todo", "toggle", "quote", "callout", "divider", "code"];
  const TYPE_SET = new Set(TYPES);
  const MARKS = ["b", "i", "u", "s", "c", "href"];
  const MAX_INDENT = 5;
  const ALLOWED_HREF_SCHEMES = ["http:", "https:", "mailto:"];
  const CHECKLIST_ATTR = "data-checklist";
  const makeId = (prefix) => window.ZenNotes?.createId ? window.ZenNotes.createId(prefix) : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function normalizeRuns(runs) {
    const result = [];
    for (const item of Array.isArray(runs) ? runs : []) {
      if (!item || typeof item.t !== "string" || !item.t) continue;
      const run = { t: item.t };
      for (const mark of MARKS) if (mark === "href" ? validHref(item.href) : item[mark]) run[mark] = mark === "href" ? safeHref(item.href) : true;
      const last = result[result.length - 1];
      if (last && MARKS.every((mark) => last[mark] === run[mark])) last.t += run.t;
      else result.push(run);
    }
    return result;
  }
  function validHref(href) {
    try { return ALLOWED_HREF_SCHEMES.includes(new URL(href).protocol); } catch (_) { return false; }
  }
  function safeHref(href) {
    try { const url = new URL(href); return ALLOWED_HREF_SCHEMES.includes(url.protocol) ? url.href : ""; } catch (_) { return ""; }
  }
  function createBlock(type = "paragraph", overrides = {}) {
    const blockType = TYPE_SET.has(type) ? type : "paragraph";
    const block = {
      id: typeof overrides.id === "string" && overrides.id ? overrides.id : makeId("block"),
      type: blockType,
      indent: Math.max(0, Math.min(MAX_INDENT, Number.isInteger(overrides.indent) ? overrides.indent : 0)),
      text: normalizeRuns(overrides.text || (overrides.content ? [{ t: String(overrides.content) }] : [])),
    };
    if (blockType === "todo") block.checked = Boolean(overrides.checked);
    if (blockType === "toggle") block.collapsed = Boolean(overrides.collapsed);
    if (blockType === "code") block.lang = typeof overrides.lang === "string" ? overrides.lang.slice(0, 30) : "";
    return block;
  }
  const getPlainText = (block) => (block?.text || []).map((run) => run.t).join("");
  function splitRuns(runs, offset) {
    const left = [], right = [];
    let position = 0;
    for (const run of normalizeRuns(runs)) {
      const end = position + run.t.length;
      const startCut = Math.max(0, Math.min(run.t.length, offset - position));
      if (startCut) left.push({ ...run, t: run.t.slice(0, startCut) });
      if (startCut < run.t.length) right.push({ ...run, t: run.t.slice(startCut) });
      position = end;
    }
    return [normalizeRuns(left), normalizeRuns(right)];
  }
  function splitBlock(block, offset) {
    const length = getPlainText(block).length;
    const [left, right] = splitRuns(block.text, Math.max(0, Math.min(length, Number(offset) || 0)));
    return [createBlock(block.type, { ...block, text: left }), createBlock(block.type, { ...block, id: undefined, text: right, checked: false, collapsed: false })];
  }
  function mergeBlocks(a, b) { return createBlock(a.type, { ...a, text: normalizeRuns([...(a.text || []), ...(b.text || [])]) }); }
  function changeBlockType(block, type) { return createBlock(type, { ...block, checked: type === "todo" ? block.checked : false, collapsed: type === "toggle" ? block.collapsed : false }); }
  function indentBlock(block) { return createBlock(block.type, { ...block, indent: Math.min(MAX_INDENT, block.indent + 1) }); }
  function outdentBlock(block) { return createBlock(block.type, { ...block, indent: Math.max(0, block.indent - 1) }); }
  function moveBlock(blocks, id, direction) {
    const next = clone(blocks);
    const from = next.findIndex((block) => block.id === id);
    if (from < 0 || !["up", "down"].includes(direction)) return next;
    // Move a block together with its contiguous descendants.
    let end = from + 1;
    while (end < next.length && next[end].indent > next[from].indent) end++;
    if (direction === "up") {
      let prev = from - 1;
      while (prev >= 0 && next[prev].indent > next[from].indent) prev--;
      if (prev < 0 || next[prev].indent !== next[from].indent) return next;
      const chunk = next.splice(from, end - from);
      next.splice(prev, 0, ...chunk);
    } else {
      if (end >= next.length || next[end].indent !== next[from].indent) return next;
      let nextEnd = end + 1;
      while (nextEnd < next.length && next[nextEnd].indent > next[from].indent) nextEnd++;
      const chunk = next.splice(from, end - from);
      const insertion = nextEnd - chunk.length;
      next.splice(insertion, 0, ...chunk);
    }
    return next;
  }
  function mapRuns(block, start, end, transform) {
    const low = Math.max(0, Math.min(start, end));
    const high = Math.max(low, Math.max(start, end));
    let pos = 0;
    const output = [];
    for (const run of normalizeRuns(block.text)) {
      const runStart = pos, runEnd = pos + run.t.length;
      const cuts = [runStart, Math.max(runStart, Math.min(runEnd, low)), Math.max(runStart, Math.min(runEnd, high)), runEnd].sort((a, b) => a - b).filter((n, i, all) => i === 0 || n !== all[i - 1]);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (a === b) continue;
        const segment = { ...run, t: run.t.slice(a - runStart, b - runStart) };
        if (a < high && b > low) transform(segment);
        output.push(segment);
      }
      pos = runEnd;
    }
    return createBlock(block.type, { ...block, text: normalizeRuns(output) });
  }
  function applyMark(block, range, markKey) {
    if (!MARKS.includes(markKey) || markKey === "href") return block;
    const start = range.start ?? range.anchor ?? 0, end = range.end ?? range.focus ?? start;
    const selected = getPlainText(block).slice(Math.min(start, end), Math.max(start, end));
    const shouldEnable = !selected || !runsHaveMark(block, Math.min(start, end), Math.max(start, end), markKey);
    return mapRuns(block, start, end, (run) => { if (shouldEnable) run[markKey] = true; else delete run[markKey]; });
  }
  function runsHaveMark(block, start, end, mark) {
    let pos = 0, found = false, all = true;
    for (const run of block.text || []) {
      const a = pos, b = pos + run.t.length;
      if (a < end && b > start) { found = true; if (!run[mark]) all = false; }
      pos = b;
    }
    return found && all;
  }
  function removeMark(block, range, markKey) {
    if (!MARKS.includes(markKey)) return block;
    const start = range.start ?? range.anchor ?? 0, end = range.end ?? range.focus ?? start;
    return mapRuns(block, start, end, (run) => { delete run[markKey]; });
  }
  function setMark(block, range, markKey, enabled) {
    if (!MARKS.includes(markKey) || markKey === "href") return block;
    const start = range.start ?? range.anchor ?? 0, end = range.end ?? range.focus ?? start;
    return mapRuns(block, start, end, (run) => { if (enabled) run[markKey] = true; else delete run[markKey]; });
  }
  function setLink(block, range, href) {
    const safe = safeHref(href);
    if (!safe) return block;
    const start = range.start ?? range.anchor ?? 0, end = range.end ?? range.focus ?? start;
    return mapRuns(block, start, end, (run) => { run.href = safe; });
  }
  function removeLink(block, range) {
    const start = range.start ?? range.anchor ?? 0, end = range.end ?? range.focus ?? start;
    return mapRuns(block, start, end, (run) => { delete run.href; });
  }
  function validateBlocks(blocks) {
    const errors = [];
    if (!Array.isArray(blocks)) return { valid: false, errors: ["blocks must be an array"] };
    const ids = new Set();
    blocks.forEach((block, index) => {
      if (!block || typeof block !== "object") { errors.push(`block ${index} must be an object`); return; }
      if (!block.id || typeof block.id !== "string") errors.push(`block ${index} has no id`);
      else if (ids.has(block.id)) errors.push(`block ${index} duplicates id ${block.id}`);
      else ids.add(block.id);
      if (!TYPE_SET.has(block.type)) errors.push(`block ${index} has invalid type`);
      if (!Number.isInteger(block.indent) || block.indent < 0 || block.indent > MAX_INDENT) errors.push(`block ${index} has invalid indent`);
      if (!Array.isArray(block.text) || block.text.some((run) => !run || typeof run.t !== "string")) errors.push(`block ${index} has invalid text runs`);
      if (block.type === "todo" && typeof block.checked !== "boolean") errors.push(`block ${index} has invalid checked flag`);
      const previous = index > 0 ? blocks[index - 1] : null;
      if (Number.isInteger(block.indent) && Number.isInteger(previous?.indent) && block.indent > previous.indent + 1) errors.push(`block ${index} skips an indent level`);
    });
    return { valid: errors.length === 0, errors };
  }

  function htmlToBlocks(html) {
    const root = window.ZenNotes.createScratchElement("div");
    root.innerHTML = window.ZenNotes.stripLegacyNamespaceAttrs(String(html || ""));
    const blocks = [];
    function textRuns(node, marks = {}) {
      if (node.nodeType === 3) return node.nodeValue ? [{ t: node.nodeValue, ...marks }] : [];
      if (node.nodeType !== 1) return [];
      const name = node.localName.toLowerCase();
      const next = { ...marks };
      if (["b", "strong"].includes(name)) next.b = true;
      if (["i", "em"].includes(name)) next.i = true;
      if (name === "u") next.u = true;
      if (["s", "strike", "del"].includes(name)) next.s = true;
      if (name === "code") next.c = true;
      if (name === "a" && validHref(node.getAttribute("href"))) next.href = safeHref(node.getAttribute("href"));
      return Array.from(node.childNodes).flatMap((child) => textRuns(child, next));
    }
    function parseList(list, indent) {
      const type = list.getAttribute(CHECKLIST_ATTR) === "true" ? "todo" : list.localName === "ol" ? "numbered" : "bullet";
      for (const li of Array.from(list.children).filter((child) => child.localName === "li")) {
        const nested = Array.from(li.children).filter((child) => child.localName === "ul" || child.localName === "ol");
        const copy = li.cloneNode(true);
        Array.from(copy.children).filter((child) => child.localName === "ul" || child.localName === "ol").forEach((child) => child.remove());
        blocks.push(createBlock(type, { indent, checked: li.getAttribute("data-checked") === "true", text: textRuns(copy) }));
        for (const child of nested) parseList(child, Math.min(MAX_INDENT, indent + 1));
      }
    }
    function parseChildren(parent, indent = 0) {
      for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 3) {
          if (child.nodeValue.trim()) blocks.push(createBlock("paragraph", { indent, text: [{ t: child.nodeValue }] }));
          continue;
        }
        if (child.nodeType !== 1) continue;
        const name = child.localName.toLowerCase();
        if (name === "ul" || name === "ol") { parseList(child, indent); continue; }
        if (name === "br") { if (!blocks.length) blocks.push(createBlock()); continue; }
        if (name === "hr") { blocks.push(createBlock("divider", { indent })); continue; }
        if (name === "li") { blocks.push(createBlock("bullet", { indent, text: textRuns(child) })); continue; }
        const type = ({ h1: "heading1", h2: "heading2", h3: "heading3", blockquote: "quote", pre: "code", aside: "callout" })[name] || "paragraph";
        const hasBlockChild = Array.from(child.children).some((element) => ["div", "p", "ul", "ol", "h1", "h2", "h3", "blockquote", "pre"].includes(element.localName.toLowerCase()));
        if (hasBlockChild && type === "paragraph") parseChildren(child, indent);
        else blocks.push(createBlock(type, { indent, text: textRuns(child) }));
      }
    }
    parseChildren(root);
    return blocks.length ? blocks : [createBlock("paragraph")];
  }

  function escapeHTML(text) { return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
  function runsToHTML(runs) {
    return normalizeRuns(runs).map((run) => {
      let text = escapeHTML(run.t);
      for (const [mark, tag] of [["b", "strong"], ["i", "em"], ["u", "u"], ["s", "s"], ["c", "code"]]) if (run[mark]) text = `<${tag}>${text}</${tag}>`;
      if (run.href) text = `<a href="${escapeHTML(run.href)}">${text}</a>`;
      return text;
    }).join("");
  }
  function blocksToHTML(blocks) {
    const listTypes = new Set(["bullet", "numbered", "todo"]);
    function renderList(start, indent) {
      const type = blocks[start].type;
      const tag = type === "numbered" ? "ol" : "ul";
      const attrs = type === "todo" ? ` ${CHECKLIST_ATTR}="true"` : "";
      const items = [];
      let index = start;
      while (index < blocks.length) {
        const block = blocks[index];
        if (!listTypes.has(block.type) || block.indent < indent) break;
        if (block.indent > indent) {
          if (!items.length) { index++; continue; }
          const nested = renderList(index, indent + 1);
          items[items.length - 1] = items[items.length - 1].replace("</li>", `${nested.html}</li>`);
          index = nested.next;
          continue;
        }
        if (block.type !== type) break;
        items.push(`<li${type === "todo" ? ` data-checked="${block.checked ? "true" : "false"}"` : ""}>${runsToHTML(block.text)}</li>`);
        index++;
      }
      return { html: `<${tag}${attrs}>${items.join("")}</${tag}>`, next: index };
    }
    const html = [];
    for (let i = 0; i < blocks.length;) {
      const block = blocks[i];
      if (listTypes.has(block.type)) {
        const list = renderList(i, block.indent);
        html.push(list.html); i = Math.max(i + 1, list.next); continue;
      }
      const text = runsToHTML(block.text);
      const tag = ({ paragraph: "div", heading1: "div", heading2: "div", heading3: "div", toggle: "div", quote: "blockquote", callout: "aside", code: "pre", divider: "hr" })[block.type] || "div";
      if (block.type === "divider") html.push("<hr>");
      else if (block.type === "toggle") html.push(`<div>${text}</div>`);
      else html.push(`<${tag}>${block.type === "code" ? `<code>${text}</code>` : text}</${tag}>`);
      i++;
    }
    return html.join("");
  }

  Object.assign(window.ZenNotes, {
    BLOCK_TYPES: TYPE_SET, MAX_BLOCK_INDENT: MAX_INDENT,
    createBlock, splitBlock, mergeBlocks, changeBlockType, indentBlock, outdentBlock,
    moveBlock, applyMark, removeMark, setMark, setLink, removeLink, getPlainText,
    htmlToBlocks, blocksToHTML, validateBlocks, normalizeRuns,
  });
})();
