// ==UserScript==
// @name            Zen Notes Editor
// @version         2.5.0-beta.4
// @description     Block editor, selection mapping, formatting, and undo for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  const MODEL = window.ZenNotes;
  const MAX_HISTORY = 200;
    const TYPE_LABELS = [
    ["paragraph", "Text"], ["heading1", "Heading 1"], ["heading2", "Heading 2"], ["heading3", "Heading 3"],
    ["bullet", "Bulleted list"], ["numbered", "Numbered list"], ["todo", "To-do list"], ["toggle", "Toggle"],
    ["quote", "Quote"], ["callout", "Callout"], ["divider", "Divider"], ["code", "Code block"],
    ];
    const MARK_TAGS = { b: "strong", i: "em", u: "u", s: "s", c: "code" };
    const CARET_NAV_KEYS = MODEL.CARET_NAV_KEYS || new Set();
    const CARET_NAV_MOVES = MODEL.CARET_NAV_MOVES || {};
    const CARET_NAV_WORD_MOVES = MODEL.CARET_NAV_WORD_MOVES || {};

  function createBlockEditor(editor, initialBlocks, options = {}) {
    const doc = editor.ownerDocument;
    const XHTML_NS = MODEL.XHTML_NS || "http://www.w3.org/1999/xhtml";
    const createElement = (name) => doc.createElementNS(XHTML_NS, name);
    const blocks = (Array.isArray(initialBlocks) && initialBlocks.length ? initialBlocks : [MODEL.createBlock("paragraph")]).map((block) => MODEL.createBlock(block.type, block));
    let onChange = options.onChange || (() => {});
    let blocksState = blocks;
    let composition = false;
    let rendering = false;
    let slashMenu = null;
    let slashActive = 0;
    let slashBlockId = "";
    let typingTimer = null;
    let history = [JSON.stringify(blocksState)];
    let historyIndex = 0;
    let historyCommittedAt = 0;
    let activeMarks = {};

    const getBlockEl = (id) => editor.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
    const textLength = (content) => { const measure = doc.createRange(); measure.selectNodeContents(content); return measure.toString().length; };
    // Maps a DOM boundary to a block offset. Boundaries on the editor or a block row
    // (what Ctrl+A produces) snap to the start or end of the nearest block.
    const pointFromBoundary = (container, offset, isEnd = false) => {
      if (container === editor) {
        const rows = Array.from(editor.children).filter((row) => row.dataset?.blockId);
        if (!rows.length) return null;
        const row = isEnd ? (offset > 0 ? editor.children[Math.min(offset, editor.children.length) - 1] : rows[0]) : (editor.children[offset] || rows[rows.length - 1]);
        const content = row?.querySelector?.(".zen-notes-block-content");
        if (!content) return null;
        const atEnd = isEnd ? offset > 0 : !editor.children[offset];
        return { blockId: row.dataset.blockId, offset: atEnd ? textLength(content) : 0 };
      }
      let node = container;
      if (node.nodeType === 3) node = node.parentElement;
      const blockEl = node?.closest?.("[data-block-id]");
      if (!blockEl || !editor.contains(blockEl)) return null;
      const content = blockEl.querySelector(".zen-notes-block-content");
      if (!content) return null;
      if (!content.contains(container)) return { blockId: blockEl.dataset.blockId, offset: isEnd ? textLength(content) : 0 };
      const measure = doc.createRange();
      try { measure.selectNodeContents(content); measure.setEnd(container, offset); }
      catch (_) { return { blockId: blockEl.dataset.blockId, offset: 0 }; }
      return { blockId: blockEl.dataset.blockId, offset: measure.toString().length };
    };
    const getSelectionPoint = () => {
      const selection = doc.defaultView.getSelection?.();
      if (!selection || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.startContainer)) return null;
      const point = pointFromBoundary(range.startContainer, range.startOffset);
      return point ? { ...point, collapsed: range.collapsed } : null;
    };
    function getSelectedPoints() {
      const selection = doc.defaultView.getSelection?.();
      if (!selection?.rangeCount || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      const start = pointFromBoundary(range.startContainer, range.startOffset);
      const end = pointFromBoundary(range.endContainer, range.endOffset, true);
      return start && end ? { start, end } : null;
    }
    const getPointAtOffset = (content, target) => {
      const walker = doc.createTreeWalker(content, doc.defaultView.NodeFilter.SHOW_TEXT, {
        acceptNode(node) { return node.parentElement?.closest(".zen-notes-control") ? doc.defaultView.NodeFilter.FILTER_REJECT : doc.defaultView.NodeFilter.FILTER_ACCEPT; },
      });
      let node, used = 0, last = null;
      while ((node = walker.nextNode())) {
        const len = node.nodeValue.length;
        if (target <= used + len) return { node, offset: Math.max(0, target - used) };
        used += len; last = node;
      }
      if (last) return { node: last, offset: last.nodeValue.length };
      return { node: content, offset: 0 };
    };
    const restorePoint = (point) => {
      if (!point) return;
      if (!doc.defaultView.getSelection?.() || !doc.defaultView.NodeFilter) return;
      const blockEl = getBlockEl(point.blockId);
      const content = blockEl?.querySelector(".zen-notes-block-content");
      if (!content) return;
      const pos = getPointAtOffset(content, point.offset);
      const range = doc.createRange();
      try { range.setStart(pos.node, pos.offset); range.collapse(true); const selection = doc.defaultView.getSelection?.(); if (!selection) return; selection.removeAllRanges(); selection.addRange(range); }
      catch (_) {}
    };
    function createInline(runs, parent, marks = {}) {
      for (const run of MODEL.normalizeRuns(runs)) {
        let leaf = doc.createTextNode(run.t);
        const attrs = { ...marks, ...run };
        for (const [mark, tag] of Object.entries(MARK_TAGS)) {
          if (!attrs[mark]) continue;
          const wrapper = createElement(tag); wrapper.appendChild(leaf); leaf = wrapper;
        }
        if (attrs.href) {
          const link = createElement("a"); link.setAttribute("href", attrs.href); link.appendChild(leaf); leaf = link;
        }
        parent.appendChild(leaf);
      }
      if (!parent.childNodes.length) parent.appendChild(createElement("br"));
    }
    function renderBlock(block) {
      const row = createElement("div");
      row.className = "zen-notes-block";
      row.dataset.blockId = block.id;
      row.dataset.type = block.type;
      row.dataset.indent = String(block.indent);
      if (block.checked) row.dataset.checked = "true";
      if (block.collapsed) row.dataset.collapsed = "true";
      if (block.type === "todo" || block.type === "toggle") {
        const control = createElement("button");
        control.type = "button";
        control.className = "zen-notes-control " + (block.type === "todo" ? "zen-notes-todo-control" : "zen-notes-toggle-btn");
        control.setAttribute("contenteditable", "false");
        control.setAttribute("aria-label", block.type === "todo" ? (block.checked ? "Mark incomplete" : "Mark complete") : (block.collapsed ? "Expand toggle" : "Collapse toggle"));
        if (block.type === "todo") control.setAttribute("aria-checked", block.checked ? "true" : "false");
        else control.textContent = block.collapsed ? "▸" : "▾";
        control.addEventListener("mousedown", (event) => event.preventDefault());
        row.appendChild(control);
      }
      const content = createElement("div");
      content.className = "zen-notes-block-content";
      if (!MODEL.getPlainText(block) && block.type !== "divider") row.dataset.empty = "true";
      if (block.type === "divider") {
        const rule = createElement("hr"); rule.setAttribute("contenteditable", "false"); content.appendChild(rule);
      } else if (block.type === "code") {
        content.classList.add("zen-notes-code-content");
        if (block.lang) content.dataset.lang = block.lang;
        createInline(block.text, content);
      } else createInline(block.text, content);
      row.appendChild(content);
      return row;
    }
    function render(point = getSelectionPoint()) {
      rendering = true;
      const fragment = doc.createDocumentFragment();
      for (const block of blocksState) fragment.appendChild(renderBlock(block));
      editor.replaceChildren(fragment);
      updateCollapsedChildren();
      rendering = false;
      if (point) restorePoint(point);
    }
    function updateCollapsedChildren() {
      const indexById = new Map(blocksState.map((block, index) => [block.id, index]));
      for (const block of blocksState) {
        if (block.type !== "toggle" || !block.collapsed) continue;
        const index = indexById.get(block.id);
        for (let next = index + 1; next < blocksState.length && blocksState[next].indent > block.indent; next++) {
          const child = getBlockEl(blocksState[next].id); if (child) child.hidden = true;
        }
      }
    }
    function commitHistory(force = false) {
      const serialized = JSON.stringify(blocksState);
      if (history[historyIndex] !== serialized) {
        history = history.slice(0, historyIndex + 1); history.push(serialized);
        if (history.length > MAX_HISTORY) history.shift();
        historyIndex = history.length - 1;
      }
      if (force) historyCommittedAt = Date.now();
    }
    function mutate(next, point, forceHistory = true) {
      if (!Array.isArray(next) || !next.length) next = [MODEL.createBlock("paragraph")];
      if (forceHistory) commitHistory(true);
      blocksState = next;
      render(point);
      onChange(blocksState);
      if (forceHistory) commitHistory(true);
    }
    function readRuns(node, inherited = {}) {
      const result = [];
      if (node.nodeType === 3) return node.nodeValue ? [{ t: node.nodeValue, ...inherited }] : result;
      if (node.nodeType !== 1 || node.classList.contains("zen-notes-control")) return result;
      const name = node.localName.toLowerCase();
      const marks = { ...inherited };
      if (["b", "strong"].includes(name)) marks.b = true;
      if (["i", "em"].includes(name)) marks.i = true;
      if (name === "u") marks.u = true;
      if (["s", "strike", "del"].includes(name)) marks.s = true;
      if (name === "code") marks.c = true;
      if (name === "a") { try { const url = new URL(node.getAttribute("href")); if (["http:", "https:", "mailto:"].includes(url.protocol)) marks.href = url.href; } catch (_) {} }
      for (const child of node.childNodes) result.push(...readRuns(child, marks));
      return result;
    }
    function syncBlockFromDOM(blockEl, scheduleHistory = true) {
      const idx = blocksState.findIndex((block) => block.id === blockEl?.dataset.blockId);
      if (idx < 0) return;
      const content = blockEl.querySelector(".zen-notes-block-content");
      const next = blocksState.slice();
      next[idx] = MODEL.createBlock(next[idx].type, { ...next[idx], text: readRuns(content) });
      blocksState = next;
      if (MODEL.getPlainText(next[idx])) delete blockEl.dataset.empty; else blockEl.dataset.empty = "true";
      if (scheduleHistory) {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { commitHistory(true); onChange(blocksState); }, 500);
      }
      onChange(blocksState);
      maybeShowSlash(blocksState[idx], getSelectionPoint());
    }
    function getCurrentBlock() {
      const point = getSelectionPoint();
      return point ? { point, index: blocksState.findIndex((block) => block.id === point.blockId), block: blocksState.find((block) => block.id === point.blockId) } : null;
    }
    function updateBlock(index, block, point) {
      const next = blocksState.slice(); next[index] = block; mutate(next, point);
    }
    function removeSlashPrefix(block, commandText) {
      const plain = MODEL.getPlainText(block);
      const nextText = plain.replace(new RegExp(`(^|\\s)/${commandText.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`), "$1");
      return MODEL.createBlock(block.type, { ...block, text: nextText ? [{ t: nextText }] : [] });
    }
    function closeSlashMenu() { if (slashMenu) slashMenu.remove(); slashMenu = null; slashBlockId = ""; }
    function openSlashMenu(block, query = "") {
      closeSlashMenu();
      slashBlockId = block.id;
      slashMenu = createElement("div");
      slashMenu.className = "zen-notes-slash-menu";
      slashMenu.setAttribute("role", "listbox");
      const filtered = TYPE_LABELS.filter(([type, label]) => `${type} ${label}`.toLowerCase().includes(query.toLowerCase()));
      filtered.forEach(([type, label], index) => {
        const item = createElement("div"); item.className = "zen-notes-slash-item"; item.dataset.type = type; item.setAttribute("role", "option"); item.textContent = label;
        if (index === slashActive) item.dataset.active = "true";
        item.addEventListener("mousedown", (event) => { event.preventDefault(); chooseSlashType(type, query); });
        slashMenu.appendChild(item);
      });
      (editor.parentElement || editor).appendChild(slashMenu);
    }
    function maybeShowSlash(block, point) {
      const text = MODEL.getPlainText(block);
      const match = text.match(/(?:^|\s)\/([\w-]*)$/);
      if (!match) { if (slashMenu) closeSlashMenu(); return; }
      slashActive = 0;
      openSlashMenu(block, match[1]);
      const row = getBlockEl(block.id); const rect = row?.getBoundingClientRect();
      if (rect && slashMenu) { slashMenu.style.top = `${rect.bottom}px`; slashMenu.style.left = `${rect.left}px`; }
    }
    function chooseSlashType(type, query = "") {
      const index = blocksState.findIndex((block) => block.id === slashBlockId);
      if (index < 0) return closeSlashMenu();
      const old = blocksState[index];
      const text = MODEL.getPlainText(old);
      const marker = text.match(/(?:^|\s)\/([\w-]*)$/);
      const prefix = marker ? text.slice(0, marker.index + (marker[0].startsWith(" ") ? 1 : 0)) : "";
      const replacement = MODEL.createBlock(type, { ...old, text: prefix ? [{ t: prefix }] : [] });
      closeSlashMenu();
      updateBlock(index, replacement, { blockId: replacement.id, offset: prefix.length });
      editor.focus();
    }
    function chooseMarkdown(block, point) {
      const text = MODEL.getPlainText(block);
      const map = { "-": "bullet", "*": "bullet", "1.": "numbered", "[]": "todo", "[ ]": "todo", "#": "heading1", "##": "heading2", "###": "heading3", ">": "quote", "```": "code", "---": "divider" };
      const key = text.trim();
      if (!map[key]) return false;
      const next = MODEL.changeBlockType(block, map[key]);
      next.text = [];
      const idx = blocksState.findIndex((item) => item.id === block.id);
      updateBlock(idx, next, { blockId: next.id, offset: 0 });
      closeSlashMenu();
      return true;
    }
    function insertNewline(event) {
      const current = getCurrentBlock(); if (!current || current.index < 0) return;
      event.preventDefault(); closeSlashMenu();
      const { block, point, index } = current;
      const text = MODEL.getPlainText(block);
      if (["bullet", "numbered", "todo"].includes(block.type) && !text.trim()) {
        const paragraph = MODEL.createBlock("paragraph", { indent: block.indent });
        const next = blocksState.slice(); next[index] = paragraph;
        mutate(next, { blockId: paragraph.id, offset: 0 }); return;
      }
      const [left, right] = MODEL.splitBlock(block, point.offset);
      const next = blocksState.slice(); next.splice(index, 1, left, right);
      mutate(next, { blockId: right.id, offset: 0 });
    }
    function deleteAtBoundary(event, backwards) {
      const current = getCurrentBlock(); if (!current || current.index < 0) return;
      const textLength = MODEL.getPlainText(current.block).length;
      if ((backwards && current.point.offset !== 0) || (!backwards && current.point.offset !== textLength)) return;
      event.preventDefault(); closeSlashMenu();
      const adjacent = current.index + (backwards ? -1 : 1);
      if (adjacent < 0 || adjacent >= blocksState.length) {
        if (current.block.indent > 0) updateBlock(current.index, MODEL.outdentBlock(current.block), current.point);
        else if (backwards && ["bullet", "numbered", "todo"].includes(current.block.type)) updateBlock(current.index, MODEL.changeBlockType(current.block, "paragraph"), current.point);
        return;
      }
      const other = blocksState[adjacent];
      if (current.block.type === "divider") {
        const next = blocksState.slice(); next.splice(current.index, 1); mutate(next, { blockId: other.id, offset: backwards ? MODEL.getPlainText(other).length : 0 }); return;
      }
      const first = backwards ? other : current.block;
      const second = backwards ? current.block : other;
      const firstIndex = Math.min(current.index, adjacent);
      if (first.indent !== second.indent || first.type !== second.type) {
        if (backwards && current.block.indent > 0) updateBlock(current.index, MODEL.outdentBlock(current.block), current.point);
        else if (backwards && ["bullet", "numbered", "todo"].includes(current.block.type) && other.type === "paragraph") updateBlock(current.index, MODEL.changeBlockType(current.block, "paragraph"), current.point);
        return;
      }
      const merged = MODEL.mergeBlocks(first, second);
      const next = blocksState.slice(); next.splice(firstIndex, 2, merged);
      const offset = backwards ? MODEL.getPlainText(first).length : current.point.offset;
      mutate(next, { blockId: merged.id, offset });
    }
    function deleteSelection(event, insertedText = "") {
      const selected = getSelectedPoints();
      if (!selected) return false;
      const startIndex = blocksState.findIndex((block) => block.id === selected.start.blockId);
      const endIndex = blocksState.findIndex((block) => block.id === selected.end.blockId);
      if (startIndex < 0 || endIndex < startIndex) return false;
      event.preventDefault(); closeSlashMenu();
      const start = blocksState[startIndex], end = blocksState[endIndex];
      const [prefix] = MODEL.splitBlock(start, selected.start.offset);
      const [, suffix] = startIndex === endIndex ? MODEL.splitBlock(start, selected.end.offset) : MODEL.splitBlock(end, selected.end.offset);
      const middle = insertedText ? MODEL.createBlock(prefix.type, { text: [{ t: insertedText }] }) : null;
      const replacement = MODEL.mergeBlocks(middle ? MODEL.mergeBlocks(prefix, middle) : prefix, suffix);
      const next = blocksState.slice(); next.splice(startIndex, endIndex - startIndex + 1, replacement);
      mutate(next, { blockId: replacement.id, offset: MODEL.getPlainText(prefix).length + insertedText.length });
      return true;
    }
    function toggleFormat(mark) {
      const current = getCurrentBlock(); if (!current) return;
      const selection = doc.defaultView.getSelection?.();
      if (!selection || selection.isCollapsed || !selection.rangeCount) { activeMarks[mark] = !activeMarks[mark]; return; }
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      const endNode = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;
      if (startNode.closest?.("[data-block-id]") !== endNode.closest?.("[data-block-id]")) return;
      const endRange = range.cloneRange(); endRange.selectNodeContents(getBlockEl(current.block.id).querySelector(".zen-notes-block-content")); endRange.setEnd(range.endContainer, range.endOffset);
      const startRange = range.cloneRange(); startRange.selectNodeContents(getBlockEl(current.block.id).querySelector(".zen-notes-block-content")); startRange.setEnd(range.startContainer, range.startOffset);
      const start = startRange.toString().length, end = endRange.toString().length;
      const nextBlock = MODEL.applyMark(current.block, { start, end }, mark);
      updateBlock(current.index, nextBlock, { blockId: current.block.id, offset: end });
    }
    function applyLink() {
      const current = getCurrentBlock(); const selection = doc.defaultView.getSelection?.();
      if (!current || !selection || selection.isCollapsed) return;
      const selected = getSelectedPoints();
      if (!selected || selected.start.blockId !== selected.end.blockId) return;
      const href = window.prompt("Enter URL:"); if (!href) return;
      const range = selection.getRangeAt(0); const content = getBlockEl(current.block.id).querySelector(".zen-notes-block-content");
      const startRange = doc.createRange(); startRange.selectNodeContents(content); startRange.setEnd(range.startContainer, range.startOffset);
      const endRange = doc.createRange(); endRange.selectNodeContents(content); endRange.setEnd(range.endContainer, range.endOffset);
      const block = MODEL.setLink(current.block, { start: startRange.toString().length, end: endRange.toString().length }, href);
      updateBlock(current.index, block, getSelectionPoint());
    }
    function undo(direction) {
      commitHistory(true);
      const nextIndex = Math.max(0, Math.min(history.length - 1, historyIndex + direction));
      if (nextIndex === historyIndex) return;
      historyIndex = nextIndex;
      blocksState = JSON.parse(history[historyIndex]);
      render(); onChange(blocksState);
    }
    function moveCurrent(direction) {
      const current = getCurrentBlock(); if (!current) return;
      commitHistory(true);
      blocksState = MODEL.moveBlock(blocksState, current.block.id, direction);
      render(current.point); onChange(blocksState); commitHistory(true);
    }
    function changeIndent(id, direction) {
      const index = blocksState.findIndex((block) => block.id === id);
      if (index < 0 || (direction !== 1 && direction !== -1)) return false;
      const root = blocksState[index];
      if (direction < 0 && root.indent === 0) return false;
      if (direction > 0 && (index === 0 || root.indent >= blocksState[index - 1].indent + 1)) return false;
      let end = index + 1;
      while (end < blocksState.length && blocksState[end].indent > root.indent) end++;
      if (direction > 0 && blocksState.slice(index, end).some((block) => block.indent >= MODEL.MAX_BLOCK_INDENT)) return false;
      const next = blocksState.slice();
      for (let child = index; child < end; child++) {
        const block = blocksState[child];
        next[child] = MODEL.createBlock(block.type, { ...block, indent: block.indent + direction });
      }
      const point = getSelectionPoint();
      mutate(next, { blockId: root.id, offset: point?.blockId === root.id ? point.offset : 0 });
      return true;
    }
    function handleCaretNavigation(event) {
      if (!CARET_NAV_KEYS.has(event.key)) return false;
      const wordMove = (event.ctrlKey || event.metaKey) && CARET_NAV_WORD_MOVES[event.key];
      if ((event.ctrlKey || event.metaKey || event.altKey) && !wordMove) return false;
      const selection = doc.defaultView.getSelection?.();
      if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return false;
      const move = wordMove || CARET_NAV_MOVES[event.key];
      if (!move) return false;
      const alter = event.shiftKey ? "extend" : "move";
      const steps = event.key === "PageUp" || event.key === "PageDown" ? (MODEL.PAGE_NAV_LINE_COUNT || 10) : 1;
      try { for (let index = 0; index < steps; index++) selection.modify(alter, move[0], move[1]); }
      catch (_) { return false; }
      event.preventDefault(); event.stopPropagation();
      return true;
    }
    const onSystemGroupKeydown = (event) => {
      if (!CARET_NAV_KEYS.has(event.key)) return;
      const wordMove = (event.ctrlKey || event.metaKey) && CARET_NAV_WORD_MOVES[event.key];
      if ((event.ctrlKey || event.metaKey || event.altKey) && !wordMove) return;
      if (!editor.contains(doc.activeElement)) return;
      event.preventDefault(); event.stopPropagation();
    };
    let systemGroupAttached = false;
    function onKeydown(event) {
      if (!editor.contains(doc.activeElement)) return;
      if (handleCaretNavigation(event)) return;
      if (slashMenu) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); const items = Array.from(slashMenu.children); if (!items.length) return;
          slashActive = (slashActive + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
          items.forEach((item, index) => item.toggleAttribute("data-active", index === slashActive)); return;
        }
        if (event.key === "Enter") { event.preventDefault(); const active = slashMenu.querySelector('[data-active="true"]') || slashMenu.firstElementChild; if (active) chooseSlashType(active.dataset.type); return; }
        if (event.key === "Escape") { event.preventDefault(); closeSlashMenu(); return; }
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "z") { event.preventDefault(); undo(event.shiftKey ? 1 : -1); return; }
        if (key === "y") { event.preventDefault(); undo(1); return; }
        if (!event.shiftKey && ["b", "i", "u", "k"].includes(key)) {
          event.preventDefault(); if (key === "k") applyLink(); else toggleFormat(({ b: "b", i: "i", u: "u" })[key]); return;
        }
        if (event.shiftKey && ["x", "l", "o", "c"].includes(key)) {
          event.preventDefault(); if (key === "x") { toggleFormat("s"); return; }
          const current = getCurrentBlock(); if (!current) return;
          const type = ({ l: "bullet", o: "numbered", c: "todo" })[key];
          const changed = MODEL.changeBlockType(current.block, current.block.type === type && type !== "paragraph" ? "paragraph" : type);
          updateBlock(current.index, changed, current.point); return;
        }
      }
      if (event.altKey && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); moveCurrent(event.key === "ArrowUp" ? "up" : "down"); return; }
      if (event.key === "Tab") {
        event.preventDefault(); const current = getCurrentBlock(); if (!current) return;
        changeIndent(current.block.id, event.shiftKey ? -1 : 1); return;
      }
      if (event.key === "Enter" && !event.shiftKey) { if (getSelectedPoints()) deleteSelection(event); insertNewline(event); return; }
      if ((event.key === "Backspace" || event.key === "Delete") && deleteSelection(event)) return;
      if (event.key === "Backspace") { deleteAtBoundary(event, true); return; }
      if (event.key === "Delete") deleteAtBoundary(event, false);
    }
    function onBeforeInput(event) {
      if (/^insert/.test(event.inputType || "") && !composition && !event.isComposing && event.inputType !== "insertFromPaste") {
        const selection = doc.defaultView.getSelection?.();
        if (selection?.rangeCount && !selection.isCollapsed && editor.contains(selection.anchorNode)) {
          // Never let the browser replace a selection itself: it can destroy block markup.
          if (typeof event.data === "string" && event.data) deleteSelection(event, event.data);
          else event.preventDefault();
          return;
        }
      }
      if (!/^delete/.test(event.inputType || "")) return;
      if (deleteSelection(event)) return;
      if (event.inputType === "deleteContentBackward") deleteAtBoundary(event, true);
      else if (event.inputType === "deleteContentForward") deleteAtBoundary(event, false);
    }
    function repairStrayDOM() {
      const stray = Array.from(editor.childNodes).some((node) => !(node.nodeType === 1 && node.dataset?.blockId));
      if (!stray) return false;
      const rows = Array.from(editor.children).filter((row) => row.dataset?.blockId);
      if (!rows.length) {
        const text = editor.textContent || "";
        blocksState = [MODEL.createBlock("paragraph", { text: text ? [{ t: text }] : [] })];
        render({ blockId: blocksState[0].id, offset: text.length }); onChange(blocksState); commitHistory(true);
      } else render(null);
      return true;
    }
    function onInput(event) {
      if (rendering || composition) return;
      if (repairStrayDOM()) return;
      const point = getSelectionPoint();
      if (!point) return;
      const blockEl = getBlockEl(point.blockId); syncBlockFromDOM(blockEl);
      const justTyped = typeof event.data === "string" ? event.data.length : 0;
      if (justTyped > 0 && Object.keys(activeMarks).length) {
        const index = blocksState.findIndex((item) => item.id === point.blockId);
        let marked = blocksState[index];
        for (const [mark, enabled] of Object.entries(activeMarks)) {
          const range = { start: Math.max(0, point.offset - justTyped), end: point.offset };
          marked = enabled ? MODEL.setMark(marked, range, mark, true) : MODEL.removeMark(marked, range, mark);
        }
        updateBlock(index, marked, point);
      }
      if (event.inputType === "insertText" && (event.data === " " || event.data === "\t")) {
        const block = blocksState.find((item) => item.id === point.blockId);
        if (block && chooseMarkdown(block, point)) return;
      }
    }
    function onClick(event) {
      const target = event.target;
      const blockEl = target.closest?.("[data-block-id]"); if (!blockEl) return;
      const block = blocksState.find((item) => item.id === blockEl.dataset.blockId); if (!block) return;
      if (target.closest(".zen-notes-todo-control")) {
        event.preventDefault(); const idx = blocksState.indexOf(block); const next = MODEL.createBlock("todo", { ...block, checked: !block.checked }); updateBlock(idx, next, { blockId: next.id, offset: MODEL.getPlainText(next).length });
      } else if (target.closest(".zen-notes-toggle-btn")) {
        event.preventDefault(); const idx = blocksState.indexOf(block); const next = MODEL.createBlock("toggle", { ...block, collapsed: !block.collapsed }); updateBlock(idx, next, getSelectionPoint());
      } else {
        const anchor = target.closest?.("a[href]");
        if (anchor) { event.preventDefault(); try { const url = new URL(anchor.href); if (["http:", "https:", "mailto:"].includes(url.protocol)) window.open(url.href, "_blank"); } catch (_) {} }
      }
    }
    function onCompositionStart() { composition = true; }
    function onCompositionEnd() { composition = false; onInput({ inputType: "insertCompositionText", data: null }); }
    function onPaste(event) {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      const html = event.clipboardData?.getData("text/html") || "";
      let current = getCurrentBlock(); if (!current) return;
      let left, right, removeCount = 1;
      const selected = getSelectedPoints();
      if (selected) {
        const startIndex = blocksState.findIndex((block) => block.id === selected.start.blockId);
        const endIndex = blocksState.findIndex((block) => block.id === selected.end.blockId);
        if (startIndex < 0 || endIndex < startIndex) return;
        current = { block: blocksState[startIndex], index: startIndex, point: selected.start };
        [left] = MODEL.splitBlock(blocksState[startIndex], selected.start.offset);
        [, right] = MODEL.splitBlock(blocksState[endIndex], selected.end.offset);
        removeCount = endIndex - startIndex + 1;
      } else [left, right] = MODEL.splitBlock(current.block, current.point.offset);
      const imported = html ? MODEL.htmlToBlocks(html) : text.replace(/\r/g, "").split("\n").map((line) => MODEL.createBlock(current.block.type, { text: line ? [{ t: line }] : [] }));
      const pasteBlocks = imported.map((block) => MODEL.createBlock(block.type, { ...block, indent: Math.min(5, current.block.indent + block.indent) }));
      let replacement;
      if (pasteBlocks.length === 1) {
        const pasted = MODEL.createBlock(current.block.type, { ...pasteBlocks[0], id: left.id, indent: current.block.indent });
        const first = MODEL.mergeBlocks(left, pasted);
        const last = MODEL.mergeBlocks(first, right);
        replacement = [last];
      } else {
        const first = left;
        const last = right;
        replacement = [first, ...pasteBlocks, last];
      }
      const next = blocksState.slice(); next.splice(current.index, removeCount, ...replacement);
      const last = replacement[replacement.length - 1];
      const offset = pasteBlocks.length === 1
        ? MODEL.getPlainText(last).length - MODEL.getPlainText(right).length
        : MODEL.getPlainText(last).length;
      mutate(next, { blockId: last.id, offset });
    }
    function onBlur() { if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; } commitHistory(true); closeSlashMenu(); onChange(blocksState); }

    editor.addEventListener("keydown", onKeydown);
    try { editor.addEventListener("keydown", onSystemGroupKeydown, { mozSystemGroup: true }); systemGroupAttached = true; }
    catch (error) { console.warn("[ZenNotes] system-group arrow guard unavailable:", error); }
    editor.addEventListener("beforeinput", onBeforeInput);
    editor.addEventListener("input", onInput);
    editor.addEventListener("click", onClick);
    editor.addEventListener("paste", onPaste);
    editor.addEventListener("compositionstart", onCompositionStart);
    editor.addEventListener("compositionend", onCompositionEnd);
    editor.addEventListener("blur", onBlur);
    render(null);
    if (!editor.children.length) mutate([MODEL.createBlock("paragraph")], null, false);
    return {
      getBlocks: () => blocksState.map((block) => MODEL.createBlock(block.type, block)),
      setBlocks(next) { blocksState = next.map((block) => MODEL.createBlock(block.type, block)); history = [JSON.stringify(blocksState)]; historyIndex = 0; render(null); },
      focus() { const content = editor.querySelector(".zen-notes-block-content"); content?.focus(); if (!doc.defaultView.getSelection?.()?.rangeCount) restorePoint({ blockId: blocksState[0].id, offset: 0 }); },
      format(mark) { toggleFormat(mark); },
      setType(type) { const current = getCurrentBlock(); if (!current) return; const nextType = current.block.type === type && ["bullet", "numbered", "todo"].includes(type) ? "paragraph" : type; updateBlock(current.index, MODEL.changeBlockType(current.block, nextType), current.point); },
      indentBlock(id) { return changeIndent(id, 1); },
      outdentBlock(id) { return changeIndent(id, -1); },
      link() { applyLink(); },
      cleanup() {
        editor.removeEventListener("keydown", onKeydown); editor.removeEventListener("beforeinput", onBeforeInput); editor.removeEventListener("input", onInput); editor.removeEventListener("click", onClick);
        if (systemGroupAttached) { try { editor.removeEventListener("keydown", onSystemGroupKeydown, { mozSystemGroup: true }); } catch (_) {} }
        editor.removeEventListener("paste", onPaste); editor.removeEventListener("compositionstart", onCompositionStart); editor.removeEventListener("compositionend", onCompositionEnd); editor.removeEventListener("blur", onBlur);
        closeSlashMenu(); if (typingTimer) clearTimeout(typingTimer);
      },
    };
  }

  Object.assign(MODEL, { createBlockEditor });
})();
