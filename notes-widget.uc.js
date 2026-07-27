// ==UserScript==
// @name            Zen Notes Widget
// @version         2.3.0
// @description     Global notes library with per-workspace pinned notes for Zen Browser sidebar
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  /* ── Preference keys ───────────────────────────────────────── */
  const PREF_DATA = "zen.notes.data";
  const PREF_SCHEMA_VERSION = "zen.notes.schemaVersion";
  const PREF_COLLAPSED = "zen.notes.collapsed";
  const PREF_HEIGHT = "zen.notes.height";
  const PREF_DEFAULT_COLOR = "zen.notes.defaultColor";
  const PREF_SHOW_WORKSPACE_KEY = "zen.notes.showWorkspaceKey";
  const PREF_APPEARANCE = "zen.notes.appearance";
  const PREF_ACTIVE_WORKSPACE = "zen.workspaces.active";
  const PREF_DATA_BACKUP = "zen.notes.dataBackup";

  // Legacy v1 prefs kept for migration/debugging.
  const LEGACY_PREF_CONTENT = "zen.notes.content";
  const LEGACY_PREF_COLOR = "zen.notes.color";
  const LEGACY_PREF_LAST_EDITED = "zen.notes.lastEdited";

  /* ── Constants ─────────────────────────────────────────────── */
  const SCHEMA_VERSION = 3;
  const VERSION = "2.3.0";

  const DEFAULT_HEIGHT = 220;
  const MIN_HEIGHT = 160;
  const MAX_HEIGHT = 460;
  const DEFAULT_COLOR = "yellow";
  const COLORS = ["yellow", "orange", "purple", "green", "blue"];
  const DEFAULT_WORKSPACE_ID = "global-default";
  const DEFAULT_WORKSPACE_LABEL = "Current workspace";
  const WORKSPACE_EVENT_NAME = "ZenWorkspacesUIUpdate";
  const WORKSPACE_DATA_EVENT_NAME = "ZenWorkspaceDataChanged";

  const DEBOUNCE_MS = 300;
  const FOCUS_DELAY_MS = 50;
  const AUTO_SAVE_INTERVAL = 5000;
  const SIDEBAR_MARGIN = 8;
  const SIDEBAR_PADDING = SIDEBAR_MARGIN * 2;
  const SCROLL_FADE_HEIGHT = 24;
  const SCROLL_BOTTOM_TOLERANCE = 2;

  // Popup panel sizing — sidebars are ~240-340px wide
  const POPUP_MARGIN = 8;
  const POPUP_MIN_WIDTH = 240;
  const POPUP_MAX_WIDTH = 320;
  const POPUP_WIDTH_RATIO = 0.9;
  const POPUP_MAX_HEIGHT = 360;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "DIV", "P", "UL", "OL", "LI"]);
  const CHECKLIST_ATTR = "data-checklist";
  const MAX_LIST_DEPTH = 4;
  const MARKDOWN_SHORTCUTS = Object.freeze({
    "-": "insertUnorderedList",
    "*": "insertUnorderedList",
    "1.": "insertOrderedList",
    "[]": "checklist",
    "[ ]": "checklist",
  });

  /* ── Preference helpers ───────────────────────────────────── */
  function getPrefString(key, defaultValue = "") {
    try { return Services.prefs.getStringPref(key, defaultValue); } catch (e) { return defaultValue; }
  }
  function setPrefString(key, value) {
    try { Services.prefs.setStringPref(key, value); } catch (e) { console.error("[ZenNotes] failed to save pref", key, e); }
  }
  function getPrefBool(key, defaultValue = false) {
    try { return Services.prefs.getBoolPref(key, defaultValue); } catch (e) { return defaultValue; }
  }
  function setPrefBool(key, value) {
    try { Services.prefs.setBoolPref(key, value); } catch (e) { console.error("[ZenNotes] failed to save pref", key, e); }
  }
  function getPrefInt(key, defaultValue = 0) {
    try { return Services.prefs.getIntPref(key, defaultValue); } catch (e) { return defaultValue; }
  }
  function getNumericPref(key, defaultValue = 0) {
    const intValue = getPrefInt(key, Number.NaN);
    if (!Number.isNaN(intValue)) return intValue;
    const stringValue = getPrefString(key, "");
    const parsed = parseInt(stringValue, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  function setPrefInt(key, value) {
    try { Services.prefs.setIntPref(key, value); } catch (e) { console.error("[ZenNotes] failed to save pref", key, e); }
  }
  function setNumericPref(key, value) {
    const normalized = Math.round(value);
    try { Services.prefs.setIntPref(key, normalized); return; } catch (e) {}
    setPrefString(key, String(normalized));
  }

  /* ── General helpers ───────────────────────────────────────── */
  function createXHTMLElement(tag) { return document.createElementNS(XHTML_NS, tag); }
  function createXULElement(tag) { return document.createElementNS(XUL_NS, tag); }
  function nowISOString() { return new Date().toISOString(); }
  function isColorValid(color) { return COLORS.includes(color); }
  function getDefaultColor() {
    const color = getPrefString(PREF_DEFAULT_COLOR, DEFAULT_COLOR);
    return isColorValid(color) ? color : DEFAULT_COLOR;
  }
  function createId(prefix) {
    if (Services.uuid && typeof Services.uuid.generateUUID === "function") {
      return `${prefix}-${Services.uuid.generateUUID().toString().replace(/[{}]/g, "")}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function clampHeight(height) { return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height)); }

  function sanitizeHTML(html) {
    const source = createXHTMLElement("div");
    const target = createXHTMLElement("div");
    source.innerHTML = html || "";
    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const tagName = node.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        for (const child of node.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) fragment.appendChild(safeChild); }
        return fragment;
      }
      const safeElement = createXHTMLElement(tagName.toLowerCase());
      if (tagName === "LI" && node.hasAttribute("data-checked")) safeElement.setAttribute("data-checked", node.getAttribute("data-checked"));
      if ((tagName === "UL" || tagName === "OL") && node.hasAttribute(CHECKLIST_ATTR)) safeElement.setAttribute(CHECKLIST_ATTR, node.getAttribute(CHECKLIST_ATTR));
      for (const child of node.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) safeElement.appendChild(safeChild); }
      return safeElement;
    }
    for (const child of source.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) target.appendChild(safeChild); }
    normalizeEditorTree(target);
    return target.innerHTML;
  }

  function normalizeEditorTree(root) {
    if (!root || !root.querySelectorAll) return;
    // Phase 1: Map legacy class="zen-notes-checklist" → data-checklist="true"
    const legacyLists = root.querySelectorAll("ul.zen-notes-checklist, ol.zen-notes-checklist");
    for (const list of legacyLists) {
      list.setAttribute(CHECKLIST_ATTR, "true");
      list.classList.remove("zen-notes-checklist");
    }
    // Phase 2: Fix ul > ul, ul > ol, ol > ul, ol > ol nesting
    let nested = root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol");
    while (nested.length > 0) {
      for (const n of nested) {
        const parent = n.parentElement;
        if (!parent) continue;
        const prevLi = n.previousElementSibling;
        if (prevLi && prevLi.tagName === "LI") {
          prevLi.appendChild(n);
        } else {
          const children = Array.from(n.childNodes);
          for (const child of children) parent.insertBefore(child, n);
          parent.removeChild(n);
        }
      }
      nested = root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol");
    }
    // Phase 3: Promote orphan LIs into wrapping ULs, merging with preceding sibling list
    const allLIs = root.querySelectorAll("li");
    for (const li of allLIs) {
      const parent = li.parentElement;
      if (parent && (parent.tagName === "UL" || parent.tagName === "OL")) continue;
      const newUl = createXHTMLElement("ul");
      if (parent) parent.insertBefore(newUl, li);
      newUl.appendChild(li);
      const prev = newUl.previousElementSibling;
      if (prev && prev.tagName === "UL") {
        while (newUl.firstChild) prev.appendChild(newUl.firstChild);
        if (newUl.parentNode) newUl.parentNode.removeChild(newUl);
      }
    }
    // Phase 4: Collapse li containing only <br> when sole child of its list
    const soleBR = root.querySelectorAll("ul > li:only-child, ol > li:only-child");
    for (const li of soleBR) {
      if (li.childNodes.length === 1 && li.childNodes[0] && li.childNodes[0].tagName === "BR") {
        const list = li.parentElement;
        if (list) list.removeChild(li);
      }
    }
    // Phase 5: Drop empty lists (no li children)
    const allLists = root.querySelectorAll("ul, ol");
    for (const list of allLists) {
      if (!list.querySelector(":scope > li")) {
        if (list.parentNode) list.parentNode.removeChild(list);
      }
    }
    // Phase 6: Strip data-checked from li not inside a [data-checklist] list
    const checkedLIs = root.querySelectorAll("li[data-checked]");
    for (const li of checkedLIs) {
      let list = li.parentElement;
      let inChecklist = false;
      while (list) {
        if ((list.tagName === "UL" || list.tagName === "OL") && list.getAttribute(CHECKLIST_ATTR) === "true") {
          inChecklist = true;
          break;
        }
        list = list.parentElement;
      }
      if (!inChecklist) li.removeAttribute("data-checked");
    }
    // Phase 7: Unwrap lists nested deeper than MAX_LIST_DEPTH
    const depthCandidates = root.querySelectorAll("ul, ol");
    for (const list of depthCandidates) {
      let depth = 0;
      let p = list.parentElement;
      while (p) {
        if (p.tagName === "UL" || p.tagName === "OL") depth++;
        p = p.parentElement;
      }
      if (depth >= MAX_LIST_DEPTH) {
        const parent = list.parentElement;
        if (!parent) continue;
        const children = Array.from(list.childNodes);
        // When the over-deep list sits inside an li, promoted li children must
        // land in that li's parent list (after the li), never inside the li —
        // an li directly inside an li is exactly the corruption we repair.
        if (parent.tagName === "LI" && parent.parentElement) {
          const ownerList = parent.parentElement;
          const anchor = parent.nextSibling;
          for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "LI") ownerList.insertBefore(child, anchor);
            else parent.appendChild(child);
          }
        } else {
          for (const child of children) parent.insertBefore(child, list);
        }
        if (list.parentNode) list.parentNode.removeChild(list);
      }
    }
  }

  function formatDate(isoString) {
    if (!isoString) return "";
    try { return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
  }
  function formatNoteEditedLabel(note) {
    if (!note) return "";
    if (note.updatedAt) return formatDate(note.updatedAt);
    return note.legacyLastEditedLabel || "";
  }
  function getDisplayTitle(title) { const cleaned = String(title || "").trim(); return cleaned || "Untitled note"; }
  function getNextNoteTitle(notes) { return `Note ${notes.length + 1}`; }

  function getWorkspaceDebugLabel(workspaceContext) {
    if (!workspaceContext) return DEFAULT_WORKSPACE_LABEL;
    const showKey = getPrefBool(PREF_SHOW_WORKSPACE_KEY, false);
    if (!showKey) return DEFAULT_WORKSPACE_LABEL;
    return `${DEFAULT_WORKSPACE_LABEL}: ${workspaceContext.id} (${workspaceContext.source})`;
  }

  /* ── Workspace resolution ──────────────────────────────────── */
  function resolveWorkspaceContext() {
    try {
      const activeWorkspace = window.gZenWorkspaces && window.gZenWorkspaces.activeWorkspace;
      if (activeWorkspace) {
        const workspaceId = typeof activeWorkspace === "string"
          ? activeWorkspace
          : activeWorkspace.id || activeWorkspace.uuid || activeWorkspace.key || "";
        if (workspaceId) return { id: String(workspaceId), source: "gZenWorkspaces", verified: true };
      }
    } catch (e) {}
    try {
      const prefWorkspace = getPrefString(PREF_ACTIVE_WORKSPACE, "");
      if (prefWorkspace) return { id: prefWorkspace, source: "pref", verified: true };
    } catch (e) {}
    const activeWorkspaceNode = document.querySelector("zen-workspace[active]");
    if (activeWorkspaceNode && activeWorkspaceNode.id) return { id: activeWorkspaceNode.id, source: "zen-workspace[active]", verified: true };
    const btn = document.querySelector("#zen-workspaces-button toolbarbutton[active='true']");
    if (btn) {
      const buttonId = btn.getAttribute("data-workspace-id") || btn.getAttribute("workspace-id") || btn.id;
      if (buttonId) return { id: buttonId, source: "workspace-button", verified: false };
    }
    return { id: DEFAULT_WORKSPACE_ID, source: "fallback", verified: false };
  }

  function extractWorkspaceIdFromEvent(event) {
    if (!event || !event.detail) return "";
    const candidates = [event.detail.activeWorkspace, event.detail.workspace, event.detail.id, event.detail.activeIndex];
    for (const candidate of candidates) {
      if (!candidate && candidate !== 0) continue;
      if (typeof candidate === "string") return candidate;
      if (typeof candidate === "object") {
        const objectId = candidate.id || candidate.uuid || candidate.key || "";
        if (objectId) return String(objectId);
      }
    }
    return "";
  }

  /* ── State model — global notes library + per-workspace pinned state ── */
  function createNote(title, overrides = {}) {
    const color = isColorValid(overrides.color) ? overrides.color : getDefaultColor();
    const timestamp = nowISOString();
    return {
      id: overrides.id || createId("note"),
      title: getDisplayTitle(title || overrides.title),
      contentHTML: sanitizeHTML(overrides.contentHTML || ""),
      color,
      createdAt: overrides.createdAt || timestamp,
      updatedAt: overrides.updatedAt || timestamp,
      legacyLastEditedLabel: overrides.legacyLastEditedLabel || "",
      order: typeof overrides.order === "number" ? overrides.order : 0,
    };
  }

  function sortNotes(notes) { return notes.slice().sort((a, b) => a.order - b.order); }
  function getGlobalNotes(state) { return sortNotes(state.notes || []); }
  function getPinnedNoteId(state, workspaceId) { return (state.workspaceState[workspaceId] || {}).pinnedActiveNoteId || null; }
  function setPinnedNoteId(state, workspaceId, noteId) {
    if (!state.workspaceState[workspaceId]) state.workspaceState[workspaceId] = {};
    state.workspaceState[workspaceId].pinnedActiveNoteId = noteId;
    persistState(state);
  }
  function getPinnedNote(state, workspaceId) {
    const notes = getGlobalNotes(state);
    if (!notes.length) return null;
    const pinnedId = getPinnedNoteId(state, workspaceId);
    return notes.find((n) => n.id === pinnedId) || notes[0];
  }
  function ensureGlobalNote(state) {
    if (!state.notes || !state.notes.length) {
      const note = createNote("Note 1", { order: 0 });
      state.notes = [note];
      return true;
    }
    return false;
  }

  function createNoteGlobal(state) {
    const notes = getGlobalNotes(state);
    const note = createNote(getNextNoteTitle(notes), { order: notes.length, color: getDefaultColor() });
    state.notes.push(note);
    persistState(state);
    return note;
  }

  function updateNoteGlobal(state, noteId, updater) {
    const note = state.notes.find((n) => n.id === noteId);
    if (!note) return null;
    updater(note);
    persistState(state);
    return note;
  }

  function moveNoteGlobal(state, noteId, direction) {
    const index = state.notes.findIndex((n) => n.id === noteId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= state.notes.length) return;
    const nextNotes = state.notes.slice();
    const [note] = nextNotes.splice(index, 1);
    nextNotes.splice(nextIndex, 0, note);
    state.notes = nextNotes.map((item, order) => ({ ...item, order }));
    persistState(state);
  }

  function deleteNoteGlobal(state, noteId) {
    const index = state.notes.findIndex((n) => n.id === noteId);
    if (index < 0) return;
    state.notes.splice(index, 1);
    if (!state.notes.length) {
      const replacement = createNote("Note 1", { order: 0 });
      state.notes.push(replacement);
    } else {
      state.notes = state.notes.map((n, order) => ({ ...n, order }));
    }
    // Repair all workspace pins that pointed at deleted note
    const firstId = state.notes[0].id;
    for (const wsId of Object.keys(state.workspaceState)) {
      if (state.workspaceState[wsId].pinnedActiveNoteId === noteId) {
        state.workspaceState[wsId].pinnedActiveNoteId = firstId;
      }
    }
    persistState(state);
  }

  function normalizeNote(note, index) {
    const n = createNote(getDisplayTitle(note && note.title), {
      id: note && note.id,
      contentHTML: note && note.contentHTML,
      color: note && note.color,
      createdAt: note && note.createdAt,
      updatedAt: note && note.updatedAt,
      legacyLastEditedLabel: note && note.legacyLastEditedLabel,
      order: typeof note?.order === "number" ? note.order : index,
    });
    n.title = getDisplayTitle(note && note.title);
    return n;
  }

  /* v2 -> v3 migration: flatten workspace note-sets into global library */
  function migrateV2toV3(v2state) {
    const wsKeys = Object.keys(v2state.workspaces || {});
    const allNotes = [];
    const usedIds = new Set();
    function uniqueId(id) {
      if (!usedIds.has(id)) { usedIds.add(id); return id; }
      let newId;
      do { newId = createId("note"); } while (usedIds.has(newId));
      usedIds.add(newId);
      return newId;
    }
    const workspaceState = {};
    let order = 0;
    for (const wsId of wsKeys) {
      const bucket = v2state.workspaces[wsId];
      const rawNotes = Array.isArray(bucket && bucket.notes) ? bucket.notes : [];
      // Track old -> new ID mapping per workspace for correct pin resolution
      const oldToNewId = new Map();
      const wsNoteIds = [];
      for (const note of rawNotes) {
        const oldId = note && note.id ? String(note.id) : "";
        const normalized = normalizeNote(note, order++);
        normalized.id = uniqueId(normalized.id || createId("note"));
        if (oldId) oldToNewId.set(oldId, normalized.id);
        wsNoteIds.push(normalized.id);
        allNotes.push(normalized);
      }
      const activeId = bucket && bucket.activeNoteId ? String(bucket.activeNoteId) : "";
      workspaceState[wsId] = {
        pinnedActiveNoteId:
          (activeId && oldToNewId.get(activeId)) ||
          wsNoteIds[0] ||
          (allNotes[0] ? allNotes[0].id : null),
      };
    }
    return {
      version: SCHEMA_VERSION,
      lastMigratedAt: nowISOString(),
      notes: allNotes.length ? allNotes : [createNote("Note 1", { order: 0 })],
      workspaceState,
    };
  }

  function createInitialV3State(initialWorkspaceId) {
    const wsId = initialWorkspaceId || DEFAULT_WORKSPACE_ID;
    const legacyContent = sanitizeHTML(getPrefString(LEGACY_PREF_CONTENT, ""));
    const legacyColor = getPrefString(LEGACY_PREF_COLOR, getDefaultColor());
    const legacyLastEditedLabel = getPrefString(LEGACY_PREF_LAST_EDITED, "");
    const hasLegacyContent = Boolean(legacyContent || legacyLastEditedLabel);
    const note = createNote(hasLegacyContent ? "Migrated note" : "Note 1", { order: 0, color: isColorValid(legacyColor) ? legacyColor : getDefaultColor() });
    if (hasLegacyContent) {
      note.contentHTML = legacyContent;
      note.updatedAt = nowISOString();
      note.legacyLastEditedLabel = legacyLastEditedLabel;
    }
    return {
      version: SCHEMA_VERSION,
      lastMigratedAt: nowISOString(),
      notes: [note],
      workspaceState: { [wsId]: { pinnedActiveNoteId: note.id } },
    };
  }

  function persistState(state) {
    setPrefString(PREF_DATA, JSON.stringify(state));
    setPrefInt(PREF_SCHEMA_VERSION, SCHEMA_VERSION);
  }

  function loadState(initialWorkspaceId) {
    const serialized = getPrefString(PREF_DATA, "");
    let state = null;
    if (serialized) {
      try { state = JSON.parse(serialized); } catch (e) { console.warn("[ZenNotes] Failed to parse state.", e); }
    }
    // No state at all — create fresh
    if (!state || typeof state !== "object") {
      if (serialized) setPrefString(PREF_DATA_BACKUP, serialized);
      state = createInitialV3State(initialWorkspaceId);
      persistState(state);
      return state;
    }
    // Detect v2 schema (has workspaces, version 2) — migrate
    if (state.version === 2 && state.workspaces) {
      setPrefString(PREF_DATA_BACKUP, serialized);
      state = migrateV2toV3(state);
      persistState(state);
      return state;
    }
    // Unknown or mismatched version — rebuild from legacy
    if (state.version !== SCHEMA_VERSION || !Array.isArray(state.notes)) {
      if (serialized) setPrefString(PREF_DATA_BACKUP, serialized);
      state = createInitialV3State(initialWorkspaceId);
      persistState(state);
      return state;
    }
    // Normalize v3 state
    let changed = false;
    state.notes = sortNotes(state.notes.map((n, i) => normalizeNote(n, i))).map((n, i) => ({ ...n, order: i }));
    if (!state.workspaceState || typeof state.workspaceState !== "object") {
      state.workspaceState = {};
      changed = true;
    }
    const wsId = initialWorkspaceId || DEFAULT_WORKSPACE_ID;
    if (!state.workspaceState[wsId]) {
      state.workspaceState[wsId] = { pinnedActiveNoteId: state.notes[0] ? state.notes[0].id : null };
      changed = true;
    }
    // Ensure at least one note exists
    if (ensureGlobalNote(state)) changed = true;
    if (changed) persistState(state);
    return state;
  }

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
    let popoverOpen = false;

    const widget = createXULElement("vbox");
    widget.id = "zen-notes-widget";
    widget.setAttribute("flex", "0");
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

    // Title trigger — shows pinned note title, opens popover on click
    const titleTrigger = createXHTMLElement("button");
    titleTrigger.className = "zen-notes-title-trigger";
    titleTrigger.setAttribute("type", "button");
    titleTrigger.setAttribute("aria-label", "Switch notes");
    titleTrigger.setAttribute("aria-haspopup", "true");
    titleTrigger.setAttribute("aria-expanded", "false");
    titleTrigger.setAttribute("title", "");

    const triggerTitle = createXHTMLElement("span");
    triggerTitle.className = "zen-notes-trigger-title";

    const triggerChevron = createXHTMLElement("span");
    triggerChevron.className = "zen-notes-trigger-chevron";
    triggerChevron.setAttribute("aria-hidden", "true");

    titleTrigger.appendChild(triggerTitle);
    titleTrigger.appendChild(triggerChevron);

    // Popover — anchored note list
    const popover = createXHTMLElement("div");
    popover.className = "zen-notes-popover";
    popover.setAttribute("role", "listbox");
    popover.setAttribute("aria-label", "Notes list");
    popover.id = "zen-notes-popover";

    const popoverList = createXHTMLElement("div");
    popoverList.className = "zen-notes-popover-list";
    popover.appendChild(popoverList);

    // Header actions
    const headerActions = createXULElement("hbox");
    headerActions.className = "zen-notes-header-actions";

    const managerBtn = createXHTMLElement("button");
    managerBtn.className = "zen-notes-icon-btn";
    managerBtn.textContent = "≡";
    managerBtn.setAttribute("title", "Manage notes");
    managerBtn.setAttribute("aria-label", "Manage notes");

    const toggle = createXHTMLElement("span");
    toggle.className = "zen-notes-toggle";
    toggle.setAttribute("aria-hidden", "true");

    headerActions.appendChild(managerBtn);
    headerActions.appendChild(toggle);

    header.appendChild(titleTrigger);
    header.appendChild(headerActions);

    /* ── Body ────────────────────────────────────────────────── */
    const body = createXHTMLElement("div");
    body.className = "zen-notes-body";
    const toolbar = createXHTMLElement("div");
    toolbar.className = "zen-notes-toolbar";

    function createToolbarButton(label, title, command) {
      const btn = createXHTMLElement("button");
      btn.className = "zen-notes-toolbar-btn";
      btn.textContent = label;
      btn.setAttribute("title", title);
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("data-command", command);
      return btn;
    }

    const boldBtn = createToolbarButton("B", "Bold (Ctrl+B)", "bold");
    const italicBtn = createToolbarButton("I", "Italic (Ctrl+I)", "italic");
    italicBtn.style.fontStyle = "italic";
    const bulletBtn = createToolbarButton("•", "Bullet list (Ctrl+Shift+L)", "insertUnorderedList");
    const numberBtn = createToolbarButton("1.", "Numbered list (Ctrl+Shift+O)", "insertOrderedList");
    const strikeBtn = createToolbarButton("S", "Strikethrough (Ctrl+Shift+X)", "strikeThrough");
    strikeBtn.style.textDecoration = "line-through";
    const checklistBtn = createToolbarButton("☐", "Checklist (Ctrl+Shift+C)", "checklist");
    const underlineBtn = createToolbarButton("U", "Underline (Ctrl+U)", "underline");
    underlineBtn.style.textDecoration = "underline";
    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(underlineBtn);
    toolbar.appendChild(strikeBtn);
    toolbar.appendChild(bulletBtn);
    toolbar.appendChild(numberBtn);
    toolbar.appendChild(checklistBtn);

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

    /* ── Manager overlay ──────────────────────────────────────── */
    const managerOverlay = createXHTMLElement("div");
    managerOverlay.id = "zen-notes-manager-overlay";
    managerOverlay.setAttribute("data-open", "false");

    const managerPanel = createXHTMLElement("div");
    managerPanel.className = "zen-notes-manager-panel";

    const managerPanelHeader = createXHTMLElement("div");
    managerPanelHeader.className = "zen-notes-manager-header";

    const managerTitleGroup = createXHTMLElement("div");
    managerTitleGroup.className = "zen-notes-manager-title-group";
    const managerTitleEl = createXHTMLElement("h2");
    managerTitleEl.className = "zen-notes-manager-title";
    managerTitleEl.textContent = "Manage notes";
    const managerSubtitle = createXHTMLElement("p");
    managerSubtitle.className = "zen-notes-manager-subtitle";

    managerTitleGroup.appendChild(managerTitleEl);
    managerTitleGroup.appendChild(managerSubtitle);

    const managerHeaderActions = createXHTMLElement("div");
    managerHeaderActions.className = "zen-notes-manager-header-actions";
    const managerNewBtn = createXHTMLElement("button");
    managerNewBtn.className = "zen-notes-manager-primary-btn";
    managerNewBtn.textContent = "New note";
    const managerCloseBtn = createXHTMLElement("button");
    managerCloseBtn.className = "zen-notes-manager-close-btn";
    managerCloseBtn.textContent = "Close";
    managerHeaderActions.appendChild(managerNewBtn);
    managerHeaderActions.appendChild(managerCloseBtn);
    managerPanelHeader.appendChild(managerTitleGroup);
    managerPanelHeader.appendChild(managerHeaderActions);

    const managerList = createXHTMLElement("div");
    managerList.className = "zen-notes-manager-list";
    managerPanel.appendChild(managerPanelHeader);
    managerPanel.appendChild(managerList);

    const settingsDivider = createXHTMLElement("hr");
    settingsDivider.className = "zen-notes-manager-divider";

    const settingsSection = createXHTMLElement("div");
    settingsSection.className = "zen-notes-manager-settings";

    const settingsTitle = createXHTMLElement("h3");
    settingsTitle.className = "zen-notes-manager-settings-title";
    settingsTitle.textContent = "Settings";

    const colorRow = createXHTMLElement("div");
    colorRow.className = "zen-notes-manager-settings-row";

    const colorLabel = createXHTMLElement("span");
    colorLabel.className = "zen-notes-manager-settings-label";
    colorLabel.textContent = "Default color";

    const colorSwatches = createXHTMLElement("div");
    colorSwatches.className = "zen-notes-manager-color-swatches";

    COLORS.forEach((color) => {
      const swatch = createXHTMLElement("span");
      swatch.className = "zen-notes-manager-color-swatch";
      swatch.setAttribute("data-color", color);
      swatch.setAttribute("role", "button");
      swatch.setAttribute("aria-label", `${color} color`);
      swatch.setAttribute("tabindex", "0");
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        flushCurrentEditorImmediately();
        setPrefString(PREF_DEFAULT_COLOR, color);
        for (const note of state.notes) {
          note.color = color;
        }
        persistState(state);
        renderAll();
        renderManager();
      });
      colorSwatches.appendChild(swatch);
    });

    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorSwatches);
    settingsSection.appendChild(settingsTitle);
    settingsSection.appendChild(colorRow);
    managerPanel.appendChild(settingsDivider);
    managerPanel.appendChild(settingsSection);
    managerOverlay.appendChild(managerPanel);

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);
    (document.body || document.documentElement).appendChild(managerOverlay);
    (document.body || document.documentElement).appendChild(popover);

    /* ── Core functions ──────────────────────────────────────── */
    function execFormat(command) { document.execCommand(command, false, null); }
    function setWidgetColor(color) { widget.className = `zen-notes-${isColorValid(color) ? color : getDefaultColor()}`; }
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
      countLabel.textContent = `${words}w · ${chars}c`;
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
      const { noteId, html } = pendingSave;
      const sanitized = sanitizeHTML(html);
      updateNoteGlobal(state, noteId, (note) => { note.contentHTML = sanitized; note.updatedAt = nowISOString(); note.legacyLastEditedLabel = ""; });
      pendingSave = null;
      setSaveStatus("Saved");
    }

    function scheduleSave(html) {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      if (!pinned) return;
      setSaveStatus("Saving\u2026");
      pendingSave = { noteId: pinned.id, html };
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { flushPendingSave(); renderManager(); }, DEBOUNCE_MS);
    }

    function flushCurrentEditorImmediately() {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      if (!pinned) return;
      pendingSave = { noteId: pinned.id, html: editor.innerHTML || "" };
      flushPendingSave();
    }

    /* ── Popover ──────────────────────────────────────────────── */
    function getPopoverRows() {
      return popoverList.querySelectorAll(".zen-notes-popover-row");
    }

    function focusPopoverRow(index) {
      const rows = getPopoverRows();
      if (index < 0) index = rows.length - 1;
      if (index >= rows.length) index = 0;
      if (rows[index]) rows[index].focus();
    }

    function openPopover() {
      popoverOpen = true;
      titleTrigger.setAttribute("aria-expanded", "true");
      popover.classList.add("zen-notes-popover--open");
      renderPopoverList();
      positionPopover();
      // Auto-focus selected or first row
      const rows = getPopoverRows();
      const selectedIndex = Array.from(rows).findIndex(
        (r) => r.getAttribute("aria-selected") === "true"
      );
      focusPopoverRow(selectedIndex >= 0 ? selectedIndex : 0);
    }

    function closePopover() {
      popoverOpen = false;
      titleTrigger.setAttribute("aria-expanded", "false");
      popover.classList.remove("zen-notes-popover--open");
      titleTrigger.focus();
    }

    function togglePopover(e) {
      e.stopPropagation();
      if (popoverOpen) { closePopover(); }
      else { openPopover(); }
    }

    function positionPopover() {
      const sidebarRect = tabsToolbar.getBoundingClientRect();
      const triggerRect = titleTrigger.getBoundingClientRect();
      const availableWidth = Math.max(0, sidebarRect.width - POPUP_MARGIN * 2);
      const desiredWidth = Math.min(
        POPUP_MAX_WIDTH,
        Math.max(POPUP_MIN_WIDTH, Math.round(availableWidth * POPUP_WIDTH_RATIO))
      );
      const panelWidth = Math.min(availableWidth, desiredWidth);
      const left = sidebarRect.left + (sidebarRect.width - panelWidth) / 2;
      const top = triggerRect.bottom + 6;
      const availableHeight = Math.round(
        Math.min(window.innerHeight - top - POPUP_MARGIN, sidebarRect.bottom - top - POPUP_MARGIN)
      );
      // Delete min-width, always set explicit width
      popover.style.minWidth = "";
      popover.style.width = `${panelWidth}px`;
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
      popover.style.maxHeight = `${Math.min(POPUP_MAX_HEIGHT, Math.max(120, availableHeight))}px`;
    }

    function renderPopoverList() {
      popoverList.textContent = "";
      const notes = getGlobalNotes(state);
      const pinnedId = getPinnedNoteId(state, currentWorkspaceId);
      notes.forEach((note) => {
        const row = createXHTMLElement("div");
        row.className = "zen-notes-popover-row";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", note.id === pinnedId ? "true" : "false");
        row.setAttribute("tabindex", "-1");
        if (note.id === pinnedId) row.classList.add("zen-notes-popover-row--selected");
        row.textContent = getDisplayTitle(note.title);
        row.setAttribute("title", getDisplayTitle(note.title));
        row.addEventListener("mousedown", (e) => { e.preventDefault(); });
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          flushCurrentEditorImmediately();
          setPinnedNoteId(state, currentWorkspaceId, note.id);
          closePopover();
          renderAll();
          setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
        });
        popoverList.appendChild(row);
      });
    }

    /* ── Title trigger ────────────────────────────────────────── */
    function updateTitleTrigger() {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      const titleText = pinned ? getDisplayTitle(pinned.title) : "No note";
      triggerTitle.textContent = titleText;
      titleTrigger.setAttribute("title", titleText);
    }

    /* ── Manager ──────────────────────────────────────────────── */
    function renderManager() {
      const notes = getGlobalNotes(state);
      const pinnedId = getPinnedNoteId(state, currentWorkspaceId);
      managerSubtitle.textContent = `${getWorkspaceDebugLabel(workspaceContext)} · ${notes.length} note${notes.length === 1 ? "" : "s"}`;
      managerList.textContent = "";
      notes.forEach((note, index) => {
        const row = createXHTMLElement("div");
        row.className = "zen-notes-manager-note";
        row.setAttribute("data-active", note.id === pinnedId ? "true" : "false");
        row.addEventListener("click", () => {
          flushCurrentEditorImmediately();
          setPinnedNoteId(state, currentWorkspaceId, note.id);
          renderAll();
          managerOverlay.setAttribute("data-open", "false");
          setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
        });
        const noteMain = createXHTMLElement("div");
        noteMain.className = "zen-notes-manager-note-main";
        const titleInput = createXHTMLElement("input");
        titleInput.className = "zen-notes-manager-title-input";
        titleInput.value = getDisplayTitle(note.title);
        titleInput.setAttribute("aria-label", "Rename note");
        titleInput.addEventListener("click", (e) => e.stopPropagation());
        titleInput.addEventListener("input", (e) => {
          e.stopPropagation();
          updateNoteGlobal(state, note.id, (n) => { n.title = getDisplayTitle(titleInput.value); n.updatedAt = nowISOString(); n.legacyLastEditedLabel = ""; });
          updateTitleTrigger();
        });
        titleInput.addEventListener("blur", () => { titleInput.value = getDisplayTitle(titleInput.value); updateTitleTrigger(); });
        const noteMeta = createXHTMLElement("span");
        noteMeta.className = "zen-notes-manager-note-meta";
        noteMeta.textContent = formatNoteEditedLabel(note) ? `Last edited ${formatNoteEditedLabel(note)}` : "Empty note";
        noteMain.appendChild(titleInput);
        noteMain.appendChild(noteMeta);
        const noteActions = createXHTMLElement("div");
        noteActions.className = "zen-notes-manager-note-actions";
        const openBtn = createXHTMLElement("button");
        openBtn.className = "zen-notes-manager-action-btn";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          flushCurrentEditorImmediately();
          setPinnedNoteId(state, currentWorkspaceId, note.id);
          renderAll();
          managerOverlay.setAttribute("data-open", "false");
          setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
        });
        const upBtn = createXHTMLElement("button");
        upBtn.className = "zen-notes-manager-action-btn";
        upBtn.textContent = "↑";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => { e.stopPropagation(); moveNoteGlobal(state, note.id, "up"); renderAll(); });
        const downBtn = createXHTMLElement("button");
        downBtn.className = "zen-notes-manager-action-btn";
        downBtn.textContent = "↓";
        downBtn.disabled = index === notes.length - 1;
        downBtn.addEventListener("click", (e) => { e.stopPropagation(); moveNoteGlobal(state, note.id, "down"); renderAll(); });
        const deleteBtn = createXHTMLElement("button");
        deleteBtn.className = "zen-notes-manager-danger-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const confirmed = Services.prompt.confirm(window, "Delete note?", `Delete “${getDisplayTitle(note.title)}” permanently? This cannot be undone.`);
          if (!confirmed) return;
          flushCurrentEditorImmediately();
          deleteNoteGlobal(state, note.id);
          renderAll();
        });
        noteActions.appendChild(openBtn);
        noteActions.appendChild(upBtn);
        noteActions.appendChild(downBtn);
        noteActions.appendChild(deleteBtn);
        row.appendChild(noteMain);
        row.appendChild(noteActions);
        managerList.appendChild(row);
      });
      const currentColor = getDefaultColor();
      if (colorSwatches) {
        colorSwatches.querySelectorAll(".zen-notes-manager-color-swatch").forEach((sw) => {
          sw.setAttribute("data-active", sw.getAttribute("data-color") === currentColor ? "true" : "false");
        });
      }
    }

    function renderActiveNote() {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      updateTitleTrigger();
      if (!pinned) { editor.innerHTML = ""; updateDateLabel(null); updateCountLabel(); return; }
      setWidgetColor(pinned.color);
      editor.innerHTML = sanitizeHTML(pinned.contentHTML || "");
      updateDateLabel(pinned);
      updateToolbarState();
      onEditorScroll();
      updateCountLabel();
    }

    function renderAll() {
      applyAppearanceMode();
      renderActiveNote();
      renderManager();
    }

    function createNewNote() {
      flushCurrentEditorImmediately();
      createNoteGlobal(state);
      renderAll();
      if (widget.getAttribute("data-collapsed") === "true") {
        widget.setAttribute("data-collapsed", "false");
        header.setAttribute("aria-expanded", "true");
        setPrefBool(PREF_COLLAPSED, false);
        widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;
      }
      setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
    }

    function syncWorkspace(nextWorkspaceId, source) {
      const resolved = nextWorkspaceId || DEFAULT_WORKSPACE_ID;
      if (resolved === currentWorkspaceId && source === workspaceContext.source) return;
      flushCurrentEditorImmediately();
      currentWorkspaceId = resolved;
      workspaceContext = { id: resolved, source: source || workspaceContext.source, verified: resolved !== DEFAULT_WORKSPACE_ID };
      // Ensure workspace state entry exists
      if (!state.workspaceState[currentWorkspaceId]) {
        state.workspaceState[currentWorkspaceId] = { pinnedActiveNoteId: state.notes[0] ? state.notes[0].id : null };
        persistState(state);
      }
      renderAll();
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

    function saveSelection() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return null;
      const walker = document.createNodeIterator(editor, NodeFilter.SHOW_TEXT, null);
      let textNode;
      let charOffset = 0;
      let startOffset = -1;
      let endOffset = -1;
      while ((textNode = walker.nextNode())) {
        if (textNode === range.startContainer) { startOffset = charOffset + range.startOffset; }
        if (textNode === range.endContainer) { endOffset = charOffset + range.endOffset; }
        if (startOffset >= 0 && endOffset >= 0) break;
        charOffset += textNode.textContent.length;
      }
      return (startOffset >= 0 || endOffset >= 0) ? { startOffset, endOffset } : null;
    }

    function restoreSelection(saved) {
      if (!saved) return;
      const sel = window.getSelection();
      if (!sel) return;
      const walker = document.createNodeIterator(editor, NodeFilter.SHOW_TEXT, null);
      let textNode;
      let charOffset = 0;
      let startNode = null, startNodeOffset = 0;
      let endNode = null, endNodeOffset = 0;
      while ((textNode = walker.nextNode())) {
        const len = textNode.textContent.length;
        if (!startNode && saved.startOffset >= charOffset && saved.startOffset <= charOffset + len) {
          startNode = textNode; startNodeOffset = saved.startOffset - charOffset;
        }
        if (!endNode && saved.endOffset >= charOffset && saved.endOffset <= charOffset + len) {
          endNode = textNode; endNodeOffset = saved.endOffset - charOffset;
        }
        if (startNode && endNode) break;
        charOffset += len;
      }
      try {
        const range = document.createRange();
        if (startNode) range.setStart(startNode, Math.min(startNodeOffset, startNode.textContent.length));
        if (endNode) range.setEnd(endNode, Math.min(endNodeOffset, endNode.textContent.length));
        if (!startNode && !endNode) { range.selectNodeContents(editor); range.collapse(false); }
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    function handleToolbarCommand(command) {
      const saved = saveSelection();
      editor.focus();
      if (command === "checklist") {
        const existing = isInsideChecklist();
        if (existing) {
          const list = getClosestList();
          if (list) { list.removeAttribute(CHECKLIST_ATTR); list.querySelectorAll("li[data-checked]").forEach((li) => li.removeAttribute("data-checked")); }
        } else {
          document.execCommand("insertUnorderedList", false, null);
          normalizeEditorTree(editor);
          const list = getClosestList();
          if (list) { list.setAttribute(CHECKLIST_ATTR, "true"); list.querySelectorAll("li").forEach((li) => { if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false"); }); }
        }
      } else {
        execFormat(command);
        if (command === "insertUnorderedList" || command === "insertOrderedList") {
          normalizeEditorTree(editor);
        }
      }
      restoreSelection(saved);
      updateToolbarState();
      scheduleSave(editor.innerHTML || "");
    }
    [boldBtn, italicBtn, underlineBtn, strikeBtn, bulletBtn, numberBtn, checklistBtn].forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); handleToolbarCommand(btn.getAttribute("data-command")); });
    });

    /* ── Event listeners ─────────────────────────────────────── */
    titleTrigger.addEventListener("click", togglePopover);

    // Close popover on outside click
    const onPopoverOutsideClick = (e) => {
      if (popoverOpen && !e.target.closest("#zen-notes-popover") && e.target !== titleTrigger && !titleTrigger.contains(e.target)) {
        closePopover();
      }
    };
    document.addEventListener("click", onPopoverOutsideClick);

    // Keyboard for popover
    titleTrigger.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !popoverOpen) { e.preventDefault(); openPopover(); }
      if (e.key === "Escape" && popoverOpen) { e.preventDefault(); closePopover(); }
    });

    // Popover list keyboard navigation
    popover.addEventListener("keydown", (e) => {
      if (!popoverOpen) return;
      const rows = getPopoverRows();
      if (!rows.length) return;
      const currentIndex = Array.from(rows).findIndex((r) => r === document.activeElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusPopoverRow(currentIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusPopoverRow(currentIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusPopoverRow(0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusPopoverRow(rows.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const focusedRow = rows[currentIndex];
        if (focusedRow) {
          e.preventDefault();
          focusedRow.click();
        }
      }
    });

    const onDocumentKeydown = (e) => {
      if (popoverOpen && e.key === "Escape") { closePopover(); e.preventDefault(); }
      if (!popoverOpen && e.key === "Escape") {
        managerOverlay.setAttribute("data-open", "false");
        widget.setAttribute("data-collapsed", "true");
        header.setAttribute("aria-expanded", "false");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    };
    document.addEventListener("keydown", onDocumentKeydown);

    managerBtn.addEventListener("click", (e) => { e.stopPropagation(); renderManager(); managerOverlay.setAttribute("data-open", "true"); });
    managerNewBtn.addEventListener("click", (e) => { e.stopPropagation(); createNewNote(); renderManager(); });
    managerCloseBtn.addEventListener("click", (e) => { e.stopPropagation(); managerOverlay.setAttribute("data-open", "false"); });
    managerOverlay.addEventListener("click", (e) => { if (e.target === managerOverlay) managerOverlay.setAttribute("data-open", "false"); });

    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    function isCheckboxHit(li, e) {
      const beforeStyle = window.getComputedStyle(li, "::before");
      let checkboxWidth = beforeStyle ? parseFloat(beforeStyle.width) : NaN;
      if (isNaN(checkboxWidth) || checkboxWidth <= 0) {
        checkboxWidth = 1.5 * parseFloat(getComputedStyle(li).fontSize);
      }
      return e.offsetX < checkboxWidth;
    }

    editor.addEventListener("click", (e) => {
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
      if (e.target === titleTrigger || titleTrigger.contains(e.target)) return;
      if (e.target.closest("#zen-notes-popover")) return;
      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const nextCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", nextCollapsed ? "true" : "false");
      header.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      setPrefBool(PREF_COLLAPSED, nextCollapsed);
      if (nextCollapsed) { widget.style.height = ""; }
      else { widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`; setTimeout(() => editor.focus(), FOCUS_DELAY_MS); }
    });

    editor.addEventListener("keydown", (e) => {
      // Tab/Shift+Tab for indent/outdent in lists
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const list = getClosestList();
        if (list) {
          e.preventDefault();
          document.execCommand(e.shiftKey ? "outdent" : "indent");
          normalizeEditorTree(editor);
          return;
        }
      }
      // Enter in lists: exit list on double-Enter at empty item
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
          // Checklist continuation: set data-checked on new item
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

      // If images are in clipboard, block them and insert only plain text
      if (hasImage) {
        if (!document.execCommand("insertText", false, plainText)) {
          fallbackInsertText(plainText);
        }
        return;
      }

      // Internal paste detection: if html exists, sanitize it and check if it
      // contains meaningful formatting (tags beyond plain text wrappers)
      if (html) {
        const sanitized = sanitizeHTML(html);
        const tempDiv = createXHTMLElement("div");
        tempDiv.innerHTML = sanitized;
        const hasFormatting = tempDiv.querySelector("b, strong, i, em, u, s, strike, del, ul, ol, li, p");
        if (hasFormatting) {
          document.execCommand("insertHTML", false, sanitized);
          return;
        }
      }

      // Default: plain text insert (preserves undo buffer)
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

    // Clear leftover empty blocks so the :empty::before placeholder returns.
    // Checklist items are meaningful even with no text (an unlabeled checkbox is
    // real user content), so never treat a surviving checklist as empty.
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
      updateDateLabel(getPinnedNote(state, currentWorkspaceId), nowISOString());
      updateCountLabel();
    });

    editor.addEventListener("blur", () => {
      flushCurrentEditorImmediately();
      renderManager();
      const pinned = getPinnedNote(state, currentWorkspaceId);
      if (pinned) {
        const current = sanitizeHTML(editor.innerHTML || "");
        const stored = sanitizeHTML(pinned.contentHTML || "");
        if (current !== stored) editor.innerHTML = stored;
        updateDateLabel(pinned);
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

    /* ── Sidebar resize handler ───────────────────────────────── */
    // Reposition popup when sidebar width changes; do NOT write hard width on widget
    const sidebarObserver = new ResizeObserver(() => { if (popoverOpen) positionPopover(); });
    sidebarObserver.observe(tabsToolbar);
    const onWindowResize = () => { if (popoverOpen) positionPopover(); };
    window.addEventListener("resize", onWindowResize);

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
      }
    } };
    Services.prefs.addObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
    Services.prefs.addObserver(PREF_APPEARANCE, prefObserver);
    window.addEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
    window.addEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);

    const autoSaveInterval = setInterval(() => { if (pendingSave) { flushPendingSave(); renderManager(); } }, AUTO_SAVE_INTERVAL);

    /* ── Cleanup ──────────────────────────────────────────────── */
    widget._zenNotesCleanup = () => {
      flushPendingSave();
      resizeObserver.disconnect();
      sidebarObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
      workspaceObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
      window.removeEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);
      document.removeEventListener("click", onPopoverOutsideClick);
      document.removeEventListener("keydown", onDocumentKeydown);
      if (editor) {
        editor.removeEventListener("scroll", onEditorScroll);
        editor.removeEventListener("keyup", updateToolbarState);
        editor.removeEventListener("mouseup", updateToolbarState);
        editor.removeEventListener("beforeinput", onEditorBeforeInput);
      }
      Services.prefs.removeObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
      Services.prefs.removeObserver(PREF_APPEARANCE, prefObserver);
      clearInterval(autoSaveInterval);
      if (saveTimeout) clearTimeout(saveTimeout);
      if (workspaceRequeryTimeout) clearTimeout(workspaceRequeryTimeout);
      if (managerOverlay && managerOverlay.parentNode) managerOverlay.parentNode.removeChild(managerOverlay);
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
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
