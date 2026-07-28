// ==UserScript==
// @name            Zen Notes UI
// @version         2.4.1
// @description     Widget DOM, event listeners, and lifecycle for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  const {
    PREF_DATA, PREF_SCHEMA_VERSION, PREF_COLLAPSED, PREF_HEIGHT,
    PREF_DEFAULT_COLOR, PREF_PRESET,
    PREF_SHOW_WORKSPACE_KEY, PREF_APPEARANCE,
    PREF_ACTIVE_WORKSPACE, PREF_DATA_BACKUP, PREF_DEBUG_KEYNAV,
    LEGACY_PREF_CONTENT, LEGACY_PREF_COLOR, LEGACY_PREF_LAST_EDITED,
    SCHEMA_VERSION, VERSION,
    DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT, PRESETS,
    DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_LABEL,
    WORKSPACE_EVENT_NAME, WORKSPACE_DATA_EVENT_NAME,
    DEBOUNCE_MS, FOCUS_DELAY_MS, AUTO_SAVE_INTERVAL,
    SIDEBAR_MARGIN, SIDEBAR_PADDING, SCROLL_FADE_HEIGHT, SCROLL_BOTTOM_TOLERANCE,
    XHTML_NS, XUL_NS, ALLOWED_TAGS, ALLOWED_HREF_SCHEMES, CHECKLIST_ATTR, MAX_LIST_DEPTH,
    MARKDOWN_SHORTCUTS, CARET_NAV_KEYS, CARET_NAV_MOVES, CARET_NAV_WORD_MOVES, PAGE_NAV_LINE_COUNT,
    getPrefString, setPrefString, getPrefBool, setPrefBool, getPrefInt,
    getNumericPref, setPrefInt, setNumericPref,
    createXHTMLElement, createXULElement, getScratchDocument, createScratchElement,
    nowISOString, getDefaultColor, createId, clampHeight,
    stripLegacyNamespaceAttrs, formatDate, formatNoteEditedLabel, getDisplayTitle,
    getWorkspaceDebugLabel, resolveWorkspaceContext, extractWorkspaceIdFromEvent,
    createNote, updateNote, createInitialV4State, persistState, loadState,
    sanitizeHTML, isTag, isListTag, normalizeEditorTree,
  } = window.ZenNotes;

  /* ── Widget builder ────────────────────────────────────────── */
  function createWidget() {
    if (document.getElementById("zen-notes-widget")) return;

    const tabsToolbar = document.getElementById("TabsToolbar");
    const footButtons = document.getElementById("zen-sidebar-foot-buttons");
    if (!tabsToolbar || !footButtons) {
      console.warn("[ZenNotes] Could not find sidebar injection point. Widget not loaded.");
      return;
    }

    let workspaceContext = resolveWorkspaceContext();
    let state = loadState(workspaceContext.id);
    let currentWorkspaceId = workspaceContext.id;
    let saveTimeout = null;
    let pendingSave = null;
    let saveStatusClearTimer = null;
    const widget = createXULElement("vbox");
    widget.id = "zen-notes-widget";
    widget.setAttribute("flex", "0");
    widget.setAttribute("keyNav", "false");
    const isCollapsed = getPrefBool(PREF_COLLAPSED, false);
    widget.setAttribute("data-collapsed", isCollapsed ? "true" : "false");
    if (!isCollapsed) widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;

    /* ── Header ──────────────────────────────────────────────── */
    const header = createXULElement("hbox");
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    header.setAttribute("aria-label", "Notes widget");

    const titleLabel = createXHTMLElement("span");
    titleLabel.className = "zen-notes-title-label";
    titleLabel.textContent = "Zen Notes";

    const headerActions = createXULElement("hbox");
    headerActions.className = "zen-notes-header-actions";

    const toggle = createXHTMLElement("span");
    toggle.className = "zen-notes-toggle";
    toggle.setAttribute("aria-hidden", "true");

    headerActions.appendChild(toggle);

    header.appendChild(titleLabel);
    header.appendChild(headerActions);

    /* ── Body ────────────────────────────────────────────────── */
    const body = createXHTMLElement("div");
    body.className = "zen-notes-body";
    const toolbar = createXHTMLElement("div");
    toolbar.className = "zen-notes-toolbar";

    function createToolbarButton(icon, title, command) {
      const btn = createXHTMLElement("button");
      btn.className = "zen-notes-toolbar-btn";
      btn.setAttribute("title", title);
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("data-command", command);
      const iconEl = createXHTMLElement("span");
      iconEl.className = "zen-notes-tb-icon";
      iconEl.setAttribute("data-icon", icon);
      btn.appendChild(iconEl);
      return btn;
    }

    function createDivider() {
      const div = createXHTMLElement("span");
      div.className = "zen-notes-tb-divider";
      div.setAttribute("aria-hidden", "true");
      return div;
    }

    const boldBtn = createToolbarButton("bold", "Bold (Ctrl+B)", "bold");
    const italicBtn = createToolbarButton("italic", "Italic (Ctrl+I)", "italic");
    const underlineBtn = createToolbarButton("underline", "Underline (Ctrl+U)", "underline");
    const strikeBtn = createToolbarButton("strikethrough", "Strikethrough (Ctrl+Shift+X)", "strikeThrough");
    const bulletBtn = createToolbarButton("bullet", "Bullet list (Ctrl+Shift+L)", "insertUnorderedList");
    const numberBtn = createToolbarButton("numbered", "Numbered list (Ctrl+Shift+O)", "insertOrderedList");
    const checklistBtn = createToolbarButton("checklist", "Checklist (Ctrl+Shift+C)", "checklist");
    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(underlineBtn);
    toolbar.appendChild(strikeBtn);
    toolbar.appendChild(createDivider());
    toolbar.appendChild(bulletBtn);
    toolbar.appendChild(numberBtn);
    toolbar.appendChild(checklistBtn);
    toolbar.appendChild(createDivider());
    const linkBtn = createToolbarButton("link", "Insert link (Ctrl+K)", "createLink");
    toolbar.appendChild(linkBtn);

    const editor = createXHTMLElement("div");
    editor.className = "zen-notes-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", "Notes editor");
    try { document.execCommand("styleWithCSS", false, false); document.execCommand("defaultParagraphSeparator", false, "div"); } catch (e) {}

    const dateLabel = createXHTMLElement("span");
    dateLabel.className = "zen-notes-date";
    const countLabel = createXHTMLElement("span");
    countLabel.className = "zen-notes-count";
    const saveStatus = createXHTMLElement("span");
    saveStatus.className = "zen-notes-save-status";
    saveStatus.setAttribute("aria-live", "polite");

    const footerRow = createXHTMLElement("div");
    footerRow.className = "zen-notes-footer-row";

    body.appendChild(toolbar);
    body.appendChild(editor);
    body.appendChild(saveStatus);
    footerRow.appendChild(dateLabel);
    footerRow.appendChild(countLabel);
    body.appendChild(footerRow);
    widget.appendChild(header);
    widget.appendChild(body);

    const dragBar = createXHTMLElement("div");
    dragBar.className = "zen-notes-drag-bar";

    let managerOverlay = null;

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);

    /* ── Core functions ──────────────────────────────────────── */
    function execFormat(command) { document.execCommand(command, false, null); }
    function applyColorMode() {
      // Only set data-preset for a known preset. An unrecognised value would
      // still match no selector in style.css while defeating the
      // :not([data-preset]) default, leaving --zen-notes-* unset.
      const preset = getPrefString(PREF_PRESET, "");
      if (PRESETS.includes(preset)) widget.setAttribute("data-preset", preset);
      else widget.removeAttribute("data-preset");
    }
    function applyAppearanceMode() {
      const mode = getPrefString(PREF_APPEARANCE, "system");
      if (mode === "light" || mode === "dark") widget.setAttribute("data-appearance", mode);
      else widget.removeAttribute("data-appearance");
    }

    function isInsideChecklist() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return false;
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      return !!node.closest("[" + CHECKLIST_ATTR + '="true"]');
    }

    function updateToolbarState() {
      const states = [[boldBtn, "bold"], [italicBtn, "italic"], [underlineBtn, "underline"], [bulletBtn, "insertUnorderedList"], [numberBtn, "insertOrderedList"], [strikeBtn, "strikeThrough"]];
      for (const [btn, command] of states) {
        let active = false;
        try { active = document.queryCommandState(command); } catch (e) {}
        btn.setAttribute("data-active", active ? "true" : "false");
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      }
      const checklistActive = isInsideChecklist();
      checklistBtn.setAttribute("data-active", checklistActive ? "true" : "false");
      checklistBtn.setAttribute("aria-pressed", checklistActive ? "true" : "false");
      let linkActive = false;
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          let node = sel.getRangeAt(0).commonAncestorContainer;
          if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
          linkActive = !!node.closest("a");
        }
      } catch (e) {}
      linkBtn.setAttribute("data-active", linkActive ? "true" : "false");
      linkBtn.setAttribute("aria-pressed", linkActive ? "true" : "false");
    }

    function updateDateLabel(note, overrideIso) {
      const label = overrideIso ? formatDate(overrideIso) : formatNoteEditedLabel(note);
      dateLabel.textContent = label ? `Last edited: ${label}` : "";
    }

    function updateCountLabel() {
      const text = editor.textContent || "";
      if (!text.trim()) { countLabel.textContent = ""; return; }
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const chars = text.length;
      countLabel.textContent = `${words}w \u00b7 ${chars}c`;
    }

    function setSaveStatus(text) {
      saveStatus.textContent = text;
      saveStatus.setAttribute("data-state", text === "" ? "idle" : text === "Saving\u2026" ? "saving" : "saved");
      if (text !== "") {
        if (saveStatusClearTimer) clearTimeout(saveStatusClearTimer);
        saveStatusClearTimer = setTimeout(() => {
          saveStatus.textContent = "";
          saveStatus.setAttribute("data-state", "idle");
        }, 1500);
      }
    }

    function flushPendingSave() {
      if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
      if (!pendingSave) return;
      const { html } = pendingSave;
      const sanitized = sanitizeHTML(html);
      if (state.note) {
        state.note.contentHTML = sanitized;
        state.note.updatedAt = nowISOString();
        state.note.legacyLastEditedLabel = "";
        persistState(state);
      }
      pendingSave = null;
      setSaveStatus("Saved");
    }

    function scheduleSave(html) {
      if (!state.note) return;
      setSaveStatus("Saving\u2026");
      pendingSave = { html };
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { flushPendingSave(); }, DEBOUNCE_MS);
    }

    function flushCurrentEditorImmediately() {
      if (!state.note) return;
      pendingSave = { html: editor.innerHTML || "" };
      flushPendingSave();
    }

    function renderActiveNote() {
      if (!state.note) { editor.innerHTML = ""; updateDateLabel(null); updateCountLabel(); return; }
      applyColorMode();
      editor.innerHTML = sanitizeHTML(state.note.contentHTML || "");
      updateDateLabel(state.note);
      updateToolbarState();
      onEditorScroll();
      updateCountLabel();
    }

    function renderAll() {
      applyAppearanceMode();
      renderActiveNote();
    }

    function syncWorkspace(nextWorkspaceId, source) {
      const resolved = nextWorkspaceId || DEFAULT_WORKSPACE_ID;
      if (resolved === currentWorkspaceId && source === workspaceContext.source) return;
      flushCurrentEditorImmediately();
      currentWorkspaceId = resolved;
      workspaceContext = { id: resolved, source: source || workspaceContext.source, verified: resolved !== DEFAULT_WORKSPACE_ID };
      state.lastWorkspaceId = resolved;
      persistState(state);
    }

    function requeryWorkspace() {
      const next = resolveWorkspaceContext();
      syncWorkspace(next.id, next.source);
    }

    function getClosestList() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      return node.closest("ul, ol");
    }

    function boundaryToOffset(container, offset) {
      try {
        const measure = document.createRange();
        measure.selectNodeContents(editor);
        measure.setEnd(container, offset);
        return measure.toString().length;
      } catch (e) {
        return -1;
      }
    }

    function saveSelection() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return null;
      const startOffset = boundaryToOffset(range.startContainer, range.startOffset);
      const endOffset = boundaryToOffset(range.endContainer, range.endOffset);
      if (startOffset < 0 || endOffset < 0) return null;
      return { startOffset, endOffset, collapsed: range.collapsed };
    }

    function offsetToBoundary(target) {
      const walker = document.createNodeIterator(editor, NodeFilter.SHOW_TEXT, null);
      let textNode;
      let charOffset = 0;
      let lastNode = null;
      let lastLen = 0;
      while ((textNode = walker.nextNode())) {
        const len = textNode.textContent.length;
        if (target <= charOffset + len) return { node: textNode, offset: Math.max(0, target - charOffset) };
        charOffset += len;
        lastNode = textNode;
        lastLen = len;
      }
      if (lastNode) return { node: lastNode, offset: lastLen };
      return null;
    }

    function collapseToEditorEnd(sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function restoreSelection(saved) {
      if (!saved) return;
      const sel = window.getSelection();
      if (!sel) return;
      try {
        const start = offsetToBoundary(saved.startOffset);
        const end = saved.collapsed ? start : offsetToBoundary(saved.endOffset);
        if (!start || !end) { collapseToEditorEnd(sel); return; }
        const range = document.createRange();
        range.setStart(start.node, Math.min(start.offset, start.node.textContent.length));
        range.setEnd(end.node, Math.min(end.offset, end.node.textContent.length));
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        collapseToEditorEnd(sel);
      }
    }

    let lastEditorSelection = null;

    function rememberEditorSelection() {
      const snapshot = saveSelection();
      if (snapshot) lastEditorSelection = snapshot;
    }

    function placeCaretAtEditorEnd() {
      const sel = window.getSelection();
      if (sel) collapseToEditorEnd(sel);
    }

    function getListsInSelection() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return [];
      const range = sel.getRangeAt(0);
      const lists = [];
      for (const list of editor.querySelectorAll("ul, ol")) {
        if (range.intersectsNode ? range.intersectsNode(list) : list.contains(range.commonAncestorContainer)) lists.push(list);
      }
      if (!lists.length) {
        const single = getClosestList();
        if (single) lists.push(single);
      }
      return lists;
    }

    function editorStructureBroken() {
      if (editor.querySelector("ul > ul, ul > ol, ol > ul, ol > ol")) return true;
      if (editor.querySelector("blockquote")) return true;
      for (const li of editor.querySelectorAll("li")) {
        const p = li.parentElement;
        if (!isListTag(p)) return true;
      }
      return false;
    }

    function repairIfBroken() {
      if (!editorStructureBroken()) return false;
      const saved = saveSelection();
      normalizeEditorTree(editor);
      if (saved) restoreSelection(saved);
      return true;
    }

    function handleToolbarCommand(command) {
      const saved = saveSelection() || lastEditorSelection;
      editor.focus();
      if (saved) restoreSelection(saved);
      else placeCaretAtEditorEnd();
      if (command === "checklist") {
        const targets = getListsInSelection();
        const alreadyChecklist = targets.length > 0 && targets.every((l) => l.getAttribute(CHECKLIST_ATTR) === "true");
        if (alreadyChecklist) {
          for (const list of targets) {
            list.removeAttribute(CHECKLIST_ATTR);
            list.querySelectorAll("li[data-checked]").forEach((li) => li.removeAttribute("data-checked"));
          }
        } else if (targets.length > 0) {
          for (const list of targets) {
            list.setAttribute(CHECKLIST_ATTR, "true");
            list.querySelectorAll("li").forEach((li) => { if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false"); });
          }
        } else {
          document.execCommand("insertUnorderedList", false, null);
          repairIfBroken();
          for (const list of getListsInSelection()) {
            list.setAttribute(CHECKLIST_ATTR, "true");
            list.querySelectorAll("li").forEach((li) => { if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false"); });
          }
        }
      } else if (command === "createLink") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const url = window.prompt("Enter URL:");
          if (url) {
            try {
              const parsed = new URL(url);
              if (ALLOWED_HREF_SCHEMES.includes(parsed.protocol)) {
                document.execCommand("createLink", false, parsed.href);
              } else {
                console.warn("[ZenNotes] blocked link scheme:", parsed.protocol);
              }
            } catch (err) {
              console.warn("[ZenNotes] invalid URL:", url);
            }
          }
        }
      } else {
        execFormat(command);
        if (command === "insertUnorderedList" || command === "insertOrderedList") repairIfBroken();
      }
      updateToolbarState();
      scheduleSave(editor.innerHTML || "");
    }
    [boldBtn, italicBtn, underlineBtn, strikeBtn, bulletBtn, numberBtn, checklistBtn, linkBtn].forEach((btn) => {
      btn.addEventListener("mousedown", (e) => { rememberEditorSelection(); e.preventDefault(); });
      btn.addEventListener("click", (e) => { e.stopPropagation(); handleToolbarCommand(btn.getAttribute("data-command")); });
    });

    const onDocumentKeydown = (e) => {
      if (e.key === "Escape") {
        if (managerOverlay) managerOverlay.setAttribute("data-open", "false");
        widget.setAttribute("data-collapsed", "true");
        header.setAttribute("aria-expanded", "false");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    };
    document.addEventListener("keydown", onDocumentKeydown);

    const onEditorSelectionActivity = () => { updateToolbarState(); rememberEditorSelection(); };
    editor.addEventListener("keyup", onEditorSelectionActivity);
    editor.addEventListener("mouseup", onEditorSelectionActivity);
    function isCheckboxHit(li, e) {
      const beforeStyle = window.getComputedStyle(li, "::before");
      let checkboxWidth = beforeStyle ? parseFloat(beforeStyle.width) : NaN;
      if (isNaN(checkboxWidth) || checkboxWidth <= 0) {
        checkboxWidth = 1.5 * parseFloat(getComputedStyle(li).fontSize);
      }
      return e.offsetX < checkboxWidth;
    }

    editor.addEventListener("click", (e) => {
      let linkTarget = e.target;
      while (linkTarget && linkTarget !== editor) {
        if (linkTarget.localName === "a" && linkTarget.hasAttribute("href")) {
          e.preventDefault();
          // Validate by parsed protocol rather than a case-sensitive prefix
          // test, so links stored by older builds with an uppercase scheme
          // still open.
          try {
            const url = new URL(linkTarget.getAttribute("href"));
            if (ALLOWED_HREF_SCHEMES.includes(url.protocol)) window.open(url.href, "_blank");
          } catch (err) {}
          return;
        }
        linkTarget = linkTarget.parentElement;
      }
      const li = e.target.closest("[" + CHECKLIST_ATTR + '="true"] > li');
      if (li && isCheckboxHit(li, e)) {
        e.preventDefault();
        const checked = li.getAttribute("data-checked") === "true";
        li.setAttribute("data-checked", checked ? "false" : "true");
        updateToolbarState();
        scheduleSave(editor.innerHTML || "");
      } else {
        updateToolbarState();
      }
    });

    header.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("input")) return;
      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const nextCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", nextCollapsed ? "true" : "false");
      header.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      setPrefBool(PREF_COLLAPSED, nextCollapsed);
      if (nextCollapsed) { widget.style.height = ""; }
      else { widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`; setTimeout(() => editor.focus(), FOCUS_DELAY_MS); }
    });

    /* ── Arrow-key escape guard + diagnostics ───────────────── */
    const describeElement = (el) => (el ? el.id || el.className || el.localName || el.tagName : "none");
    const shouldLogArrowDiag = () => getPrefBool(PREF_DEBUG_KEYNAV, false);

    function moveCaret(e) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return false;
      if (!editor.contains(selection.anchorNode)) return false;
      const wordMove = (e.ctrlKey || e.metaKey) && CARET_NAV_WORD_MOVES[e.key];
      const move = wordMove || CARET_NAV_MOVES[e.key];
      if (!move) return false;
      const alter = e.shiftKey ? "extend" : "move";
      const steps = (e.key === "PageUp" || e.key === "PageDown") ? PAGE_NAV_LINE_COUNT : 1;
      try {
        for (let i = 0; i < steps; i++) selection.modify(alter, move[0], move[1]);
      } catch (err) {
        return false;
      }
      return true;
    }

    const onEditorKeyNavKeydown = (e) => {
      if (!CARET_NAV_KEYS.has(e.key)) return;
      const isWordMove = (e.ctrlKey || e.metaKey) && !!CARET_NAV_WORD_MOVES[e.key];
      if ((e.ctrlKey || e.metaKey || e.altKey) && !isWordMove) return;
      const moved = moveCaret(e);
      if (shouldLogArrowDiag()) {
        console.log("[ZenNotes] caret key=" + e.key + " moved=" + (moved ? "yes" : "no") + " activeEl=" + describeElement(document.activeElement));
      }
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      updateToolbarState();
    };
    editor.addEventListener("keydown", onEditorKeyNavKeydown);

    const onEditorKeyNavSystemGroup = (e) => {
      if (!CARET_NAV_KEYS.has(e.key)) return;
      const isWordMove = (e.ctrlKey || e.metaKey) && !!CARET_NAV_WORD_MOVES[e.key];
      if ((e.ctrlKey || e.metaKey || e.altKey) && !isWordMove) return;
      if (!editor.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    let systemGroupGuardAttached = false;
    try {
      editor.addEventListener("keydown", onEditorKeyNavSystemGroup, { mozSystemGroup: true });
      systemGroupGuardAttached = true;
    } catch (err) {
      console.warn("[ZenNotes] system-group key guard unavailable:", err);
    }
    if (getPrefBool(PREF_DEBUG_KEYNAV, false)) {
      console.log("[ZenNotes] systemGroupGuard=" + (systemGroupGuardAttached ? "attached" : "unavailable"));
    }

    editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const list = getClosestList();
        if (list) {
          e.preventDefault();
          document.execCommand(e.shiftKey ? "outdent" : "indent");
          repairIfBroken();
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const list = getClosestList();
        if (list) {
          let li = window.getSelection();
          if (li && li.rangeCount) {
            let node = li.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            li = node.closest("li");
          }
          if (li && !li.textContent.trim()) {
            e.preventDefault();
            document.execCommand("outdent");
            if (getClosestList()) {
              document.execCommand("insertParagraph");
            }
            return;
          }
          if (list.getAttribute(CHECKLIST_ATTR) === "true") {
            setTimeout(() => {
              const newLi = list.querySelector("li:not([data-checked])");
              if (newLi) newLi.setAttribute("data-checked", "false");
            }, 0);
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "b" || e.key === "B") { e.preventDefault(); handleToolbarCommand("bold"); }
        else if (e.key === "i" || e.key === "I") { e.preventDefault(); handleToolbarCommand("italic"); }
        else if (e.key === "u" || e.key === "U") { e.preventDefault(); handleToolbarCommand("underline"); }
        else if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) {
            const url = window.prompt("Enter URL:");
            if (url) {
              try {
                const parsed = new URL(url);
                if (ALLOWED_HREF_SCHEMES.includes(parsed.protocol)) {
                  document.execCommand("createLink", false, parsed.href);
                } else {
                  console.warn("[ZenNotes] blocked link scheme:", parsed.protocol);
                }
              } catch (err) {
                console.warn("[ZenNotes] invalid URL:", url);
              }
            }
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        if (e.key === "x" || e.key === "X") { e.preventDefault(); handleToolbarCommand("strikeThrough"); }
        else if (e.key === "l" || e.key === "L") { e.preventDefault(); handleToolbarCommand("insertUnorderedList"); }
        else if (e.key === "o" || e.key === "O") { e.preventDefault(); handleToolbarCommand("insertOrderedList"); }
        else if (e.key === "c" || e.key === "C") { e.preventDefault(); handleToolbarCommand("checklist"); }
      }
    });

    editor.addEventListener("paste", (e) => {
      e.preventDefault();
      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const items = clipboard.items;
      let hasImage = false;
      if (items) {
        for (const item of items) {
          if (item.type && item.type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
      }

      const plainText = clipboard.getData("text/plain") || "";
      const html = clipboard.getData("text/html");

      if (hasImage) {
        if (!document.execCommand("insertText", false, plainText)) {
          fallbackInsertText(plainText);
        }
        return;
      }

      const pastedUrl = (() => {
        if (!plainText) return null;
        try {
          const url = new URL(plainText.trim());
          return ALLOWED_HREF_SCHEMES.includes(url.protocol) ? url : null;
        } catch (err) { return null; }
      })();

      if (pastedUrl) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          if (!sel.isCollapsed) {
            document.execCommand("createLink", false, pastedUrl.href);
            return;
          } else {
            // & must be escaped in an attribute value or the parser eats it as
            // an entity reference (?a=1&copy=2 becomes ?a=1©=2).
            const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            document.execCommand("insertHTML", false, `<a href="${escapeAttr(pastedUrl.href)}">${escapeText(pastedUrl.href)}</a>`);
            return;
          }
        }
      }

      if (html) {
        const sanitized = sanitizeHTML(html);
        const tempDiv = createScratchElement("div");
        tempDiv.innerHTML = sanitized;
        const hasFormatting = tempDiv.querySelector("b, strong, i, em, u, s, strike, del, ul, ol, li, p");
        if (hasFormatting) {
          document.execCommand("insertHTML", false, sanitized);
          return;
        }
      }

      if (!document.execCommand("insertText", false, plainText)) {
        fallbackInsertText(plainText);
      }
    });

    function fallbackInsertText(text) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const onEditorBeforeInput = (e) => {
      if (e.inputType === "deleteContentBackward") {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed || range.startOffset !== 0) return;
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE && node.parentElement) node = node.parentElement;
        const li = node.nodeType === Node.ELEMENT_NODE ? node.closest("li") : null;
        if (!li) return;
        const list = li.closest("ul, ol");
        if (!list) return;
        if (li !== list.firstElementChild) return;
        e.preventDefault();
        const parentLi = list.parentElement ? list.parentElement.closest("li") : null;
        if (parentLi) {
          document.execCommand("outdent");
        } else {
          if (!document.execCommand("outdent")) {
            const p = createXHTMLElement("div");
            p.innerHTML = li.innerHTML || "";
            if (list.parentNode) list.parentNode.insertBefore(p, list);
            list.removeChild(li);
            if (!list.querySelector("li") && list.parentNode) list.parentNode.removeChild(list);
          }
        }
        normalizeEditorTree(editor);
        resetEditorIfEmpty();
      } else if (e.inputType === "deleteContentForward" || e.inputType === "deleteByDraft") {
        setTimeout(() => {
          normalizeEditorTree(editor);
          resetEditorIfEmpty();
        }, 0);
      } else if (e.inputType === "insertText" && e.data === " ") {
        tryMarkdownShortcut(e);
      }
    };

    function resetEditorIfEmpty() {
      if (editor.textContent.trim()) return;
      if (editor.querySelector("[" + CHECKLIST_ATTR + '="true"]')) return;
      editor.innerHTML = "";
    }

    function tryMarkdownShortcut(e) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const block = node.closest("div, p, li");
      if (!block || !editor.contains(block)) return;
      if (block.closest("ul, ol")) return;
      const walker = document.createNodeIterator(block, NodeFilter.SHOW_TEXT, null);
      let prefix = "";
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode === range.startContainer) { prefix += textNode.textContent.substring(0, range.startOffset); break; }
        prefix += textNode.textContent;
      }
      const shortcutCommand = MARKDOWN_SHORTCUTS[prefix];
      if (!shortcutCommand) return;
      e.preventDefault();
      sel.removeAllRanges();
      const delRange = document.createRange();
      delRange.setStart(block, 0);
      delRange.setEnd(range.startContainer, range.startOffset);
      sel.addRange(delRange);
      document.execCommand("delete");
      if (shortcutCommand === "checklist") {
        document.execCommand("insertUnorderedList");
        normalizeEditorTree(editor);
        const list = getClosestList();
        if (list) { list.setAttribute(CHECKLIST_ATTR, "true"); list.querySelectorAll("li").forEach((li) => { if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false"); }); }
      } else {
        document.execCommand(shortcutCommand);
        normalizeEditorTree(editor);
      }
    }
    editor.addEventListener("beforeinput", onEditorBeforeInput);

    editor.addEventListener("input", () => {
      scheduleSave(editor.innerHTML || "");
      updateDateLabel(state.note, nowISOString());
      updateCountLabel();
    });

    editor.addEventListener("blur", () => {
      flushCurrentEditorImmediately();
      if (state.note) {
        const current = sanitizeHTML(editor.innerHTML || "");
        const stored = sanitizeHTML(state.note.contentHTML || "");
        if (current !== stored) editor.innerHTML = stored;
        updateDateLabel(state.note);
      }
    });

    function onEditorScroll() {
      if (!editor) return;
      const atBottom = editor.scrollTop + editor.clientHeight >= editor.scrollHeight - SCROLL_BOTTOM_TOLERANCE;
      editor.setAttribute("data-scroll-bottom", atBottom ? "true" : "false");
    }
    editor.addEventListener("scroll", onEditorScroll);

    /* ── Drag ─────────────────────────────────────────────────── */
    let isDragging = false;
    let dragStartY = 0;
    let dragStartHeight = 0;
    function onMouseMove(e) {
      if (!isDragging) return;
      widget.style.height = `${clampHeight(dragStartHeight + (dragStartY - e.clientY))}px`;
    }
    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      dragBar.classList.remove("zen-notes-drag-bar--active");
      setNumericPref(PREF_HEIGHT, clampHeight(Math.round(widget.getBoundingClientRect().height)));
    }
    dragBar.addEventListener("mousedown", (e) => {
      if (widget.getAttribute("data-collapsed") === "true") return;
      isDragging = true;
      dragBar.classList.add("zen-notes-drag-bar--active");
      dragStartY = e.clientY;
      dragStartHeight = widget.getBoundingClientRect().height;
      e.preventDefault();
    });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    const resizeObserver = new ResizeObserver((entries) => {
      if (isDragging) return;
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) setNumericPref(PREF_HEIGHT, h);
      }
    });
    resizeObserver.observe(widget);

    /* ── Workspace ────────────────────────────────────────────── */
    function onWorkspaceEvent(event) {
      const nextId = extractWorkspaceIdFromEvent(event);
      if (nextId) syncWorkspace(nextId, event.type);
      else requeryWorkspace();
    }
    let workspaceRequeryTimeout = null;
    const workspaceObserver = new MutationObserver(() => {
      if (workspaceRequeryTimeout) clearTimeout(workspaceRequeryTimeout);
      workspaceRequeryTimeout = setTimeout(() => { workspaceRequeryTimeout = null; requeryWorkspace(); }, 50);
    });
    const workspaceContainer = document.getElementById("tabbrowser-arrowscrollbox") || document.documentElement;
    workspaceObserver.observe(workspaceContainer, { subtree: true, attributes: true, attributeFilter: ["active"] });

    const prefObserver = { observe(subject, topic, data) {
      if (topic === "nsPref:changed") {
        if (data === PREF_ACTIVE_WORKSPACE) requeryWorkspace();
        if (data === PREF_APPEARANCE) applyAppearanceMode();
        if (data === PREF_PRESET) renderAll();
      }
    } };
    Services.prefs.addObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
    Services.prefs.addObserver(PREF_APPEARANCE, prefObserver);
    Services.prefs.addObserver(PREF_PRESET, prefObserver);
    window.addEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
    window.addEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);

    const autoSaveInterval = setInterval(() => { if (pendingSave) { flushPendingSave(); } }, AUTO_SAVE_INTERVAL);

    /* ── Cleanup ──────────────────────────────────────────────── */
    widget._zenNotesCleanup = () => {
      flushPendingSave();
      resizeObserver.disconnect();
      workspaceObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
      window.removeEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);
      document.removeEventListener("keydown", onDocumentKeydown);
      if (editor) {
        editor.removeEventListener("scroll", onEditorScroll);
        editor.removeEventListener("keyup", onEditorSelectionActivity);
        editor.removeEventListener("mouseup", onEditorSelectionActivity);
        editor.removeEventListener("beforeinput", onEditorBeforeInput);
        editor.removeEventListener("keydown", onEditorKeyNavKeydown);
        if (systemGroupGuardAttached) {
          try { editor.removeEventListener("keydown", onEditorKeyNavSystemGroup, { mozSystemGroup: true }); } catch (err) {}
        }
      }
      Services.prefs.removeObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
      Services.prefs.removeObserver(PREF_APPEARANCE, prefObserver);
      Services.prefs.removeObserver(PREF_PRESET, prefObserver);
      clearInterval(autoSaveInterval);
      if (saveTimeout) clearTimeout(saveTimeout);
      if (workspaceRequeryTimeout) clearTimeout(workspaceRequeryTimeout);
      /* manager overlay block removed in 2.4.1 */
      if (dragBar && dragBar.parentNode) dragBar.parentNode.removeChild(dragBar);
      if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
    };

    renderAll();
  }

  function createWidgetSafe(attempt = 0) {
    try { createWidget(); } catch (e) { console.error("[ZenNotes] Failed to initialize widget:", e); }
    if (!document.getElementById("zen-notes-widget") && attempt < 3) {
      setTimeout(() => createWidgetSafe(attempt + 1), 200 * (attempt + 1));
    }
  }
  function init() {
    console.info("[ZenNotes] v" + VERSION + " loaded");
    if (document.readyState === "complete" || document.readyState === "interactive") createWidgetSafe();
    else window.addEventListener("DOMContentLoaded", () => createWidgetSafe(), { once: true });
  }
  function cleanup() {
    const w = document.getElementById("zen-notes-widget");
    if (w && w._zenNotesCleanup) w._zenNotesCleanup();
  }
  if (typeof window.addUnloadListener === "function") {
    window.addUnloadListener(cleanup);
  }
  window.addEventListener("unload", cleanup, { once: true });
  init();
})();
