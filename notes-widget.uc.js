// ==UserScript==
// @name            Zen Notes Widget
// @version         2.0.0
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
  const PREF_ACTIVE_WORKSPACE = "zen.workspaces.active";
  const PREF_DATA_BACKUP = "zen.notes.dataBackup";

  // Legacy v1 prefs kept for migration/debugging.
  const LEGACY_PREF_CONTENT = "zen.notes.content";
  const LEGACY_PREF_COLOR = "zen.notes.color";
  const LEGACY_PREF_LAST_EDITED = "zen.notes.lastEdited";

  /* ── Constants ─────────────────────────────────────────────── */
  const SCHEMA_VERSION = 3;
  const VERSION = "2.0.0";

  const DEFAULT_HEIGHT = 220;
  const MIN_HEIGHT = 110;
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

  // Popup panel sizing — sidebars are ~240-340px wide
  const POPUP_MARGIN = 8;
  const POPUP_MIN_WIDTH = 240;
  const POPUP_MAX_WIDTH = 320;
  const POPUP_WIDTH_RATIO = 0.9;
  const POPUP_MAX_HEIGHT = 360;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "UL", "OL", "LI"]);

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
      for (const child of node.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) safeElement.appendChild(safeChild); }
      return safeElement;
    }
    for (const child of source.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) target.appendChild(safeChild); }
    return target.innerHTML;
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

    const colorDot = createXHTMLElement("span");
    colorDot.className = "zen-notes-color-dot";
    colorDot.setAttribute("role", "button");
    colorDot.setAttribute("aria-label", "Change note color");

    const colorPalette = createXHTMLElement("span");
    colorPalette.className = "zen-notes-color-palette";
    colorPalette.setAttribute("data-visible", "false");

    COLORS.forEach((color) => {
      const swatch = createXHTMLElement("span");
      swatch.className = "zen-notes-color-swatch";
      swatch.setAttribute("data-color", color);
      swatch.setAttribute("role", "button");
      swatch.setAttribute("aria-label", `${color} color`);
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        flushPendingSave();
        const pinned = getPinnedNote(state, currentWorkspaceId);
        if (!pinned) return;
        updateNoteGlobal(state, pinned.id, (note) => { note.color = color; note.updatedAt = nowISOString(); note.legacyLastEditedLabel = ""; });
        colorPalette.setAttribute("data-visible", "false");
        renderAll();
      });
      colorPalette.appendChild(swatch);
    });

    colorDot.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = colorPalette.getAttribute("data-visible") === "true";
      if (!visible) {
        const pinned = getPinnedNote(state, currentWorkspaceId);
        if (pinned) {
          const activeSwatch = colorPalette.querySelector(`[data-color="${pinned.color}"]`);
          if (activeSwatch) colorPalette.appendChild(activeSwatch);
        }
      }
      colorPalette.setAttribute("data-visible", visible ? "false" : "true");
    });

    const managerBtn = createXHTMLElement("button");
    managerBtn.className = "zen-notes-icon-btn";
    managerBtn.textContent = "≡";
    managerBtn.setAttribute("title", "Manage notes");
    managerBtn.setAttribute("aria-label", "Manage notes");

    const toggle = createXHTMLElement("span");
    toggle.className = "zen-notes-toggle";
    toggle.setAttribute("aria-hidden", "true");

    headerActions.appendChild(colorDot);
    headerActions.appendChild(colorPalette);
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

    const boldBtn = createToolbarButton("B", "Bold", "bold");
    const italicBtn = createToolbarButton("I", "Italic", "italic");
    italicBtn.style.fontStyle = "italic";
    const bulletBtn = createToolbarButton("•", "Bullet list", "insertUnorderedList");
    const numberBtn = createToolbarButton("1.", "Numbered list", "insertOrderedList");
    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(bulletBtn);
    toolbar.appendChild(numberBtn);

    const editor = createXHTMLElement("div");
    editor.className = "zen-notes-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", "Notes editor");

    const dateLabel = createXHTMLElement("span");
    dateLabel.className = "zen-notes-date";

    body.appendChild(toolbar);
    body.appendChild(editor);
    body.appendChild(dateLabel);
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
    managerOverlay.appendChild(managerPanel);

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);
    (document.body || document.documentElement).appendChild(managerOverlay);
    document.body.appendChild(popover);

    /* ── Core functions ──────────────────────────────────────── */
    function execFormat(command) { document.execCommand(command, false, null); }
    function setWidgetColor(color) { widget.className = `zen-notes-${isColorValid(color) ? color : getDefaultColor()}`; }

    function updateToolbarState() {
      const states = [[boldBtn, "bold"], [italicBtn, "italic"], [bulletBtn, "insertUnorderedList"], [numberBtn, "insertOrderedList"]];
      for (const [btn, command] of states) {
        let active = false;
        try { active = document.queryCommandState(command); } catch (e) {}
        btn.setAttribute("data-active", active ? "true" : "false");
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    function updateDateLabel(note, overrideIso) {
      const label = overrideIso ? formatDate(overrideIso) : formatNoteEditedLabel(note);
      dateLabel.textContent = label ? `Last edited: ${label}` : "";
    }

    function flushPendingSave() {
      if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
      if (!pendingSave) return;
      const { noteId, html } = pendingSave;
      const sanitized = sanitizeHTML(html);
      updateNoteGlobal(state, noteId, (note) => { note.contentHTML = sanitized; note.updatedAt = nowISOString(); note.legacyLastEditedLabel = ""; });
      pendingSave = null;
    }

    function scheduleSave(html) {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      if (!pinned) return;
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
    }

    function renderActiveNote() {
      const pinned = getPinnedNote(state, currentWorkspaceId);
      updateTitleTrigger();
      if (!pinned) { editor.innerHTML = ""; updateDateLabel(null); return; }
      setWidgetColor(pinned.color);
      editor.innerHTML = sanitizeHTML(pinned.contentHTML || "");
      updateDateLabel(pinned);
      updateToolbarState();
    }

    function renderAll() {
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

    function handleToolbarCommand(command) { editor.focus(); execFormat(command); updateToolbarState(); scheduleSave(editor.innerHTML || ""); }
    [boldBtn, italicBtn, bulletBtn, numberBtn].forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); handleToolbarCommand(btn.getAttribute("data-command")); });
    });

    /* ── Event listeners ─────────────────────────────────────── */
    titleTrigger.addEventListener("click", togglePopover);

    // Close popover on outside click
    document.addEventListener("click", (e) => {
      if (popoverOpen && !e.target.closest("#zen-notes-popover") && e.target !== titleTrigger && !titleTrigger.contains(e.target)) {
        closePopover();
      }
    });

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

    document.addEventListener("keydown", (e) => {
      if (popoverOpen && e.key === "Escape") { closePopover(); e.preventDefault(); }
      if (!popoverOpen && e.key === "Escape") {
        managerOverlay.setAttribute("data-open", "false");
        widget.setAttribute("data-collapsed", "true");
        header.setAttribute("aria-expanded", "false");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    });

    managerBtn.addEventListener("click", (e) => { e.stopPropagation(); renderManager(); managerOverlay.setAttribute("data-open", "true"); });
    managerNewBtn.addEventListener("click", (e) => { e.stopPropagation(); createNewNote(); renderManager(); });
    managerCloseBtn.addEventListener("click", (e) => { e.stopPropagation(); managerOverlay.setAttribute("data-open", "false"); });
    managerOverlay.addEventListener("click", (e) => { if (e.target === managerOverlay) managerOverlay.setAttribute("data-open", "false"); });

    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("click", updateToolbarState);

    header.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".zen-notes-color-swatch") || e.target.closest(".zen-notes-color-dot")) return;
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
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "b" || e.key === "B") { e.preventDefault(); handleToolbarCommand("bold"); }
        else if (e.key === "i" || e.key === "I") { e.preventDefault(); handleToolbarCommand("italic"); }
      }
    });

    editor.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain") || "");
          return;
        }
      }
    });

    editor.addEventListener("input", () => {
      scheduleSave(editor.innerHTML || "");
      updateDateLabel(getPinnedNote(state, currentWorkspaceId), nowISOString());
    });

    editor.addEventListener("blur", () => {
      flushCurrentEditorImmediately();
      renderManager();
      const pinned = getPinnedNote(state, currentWorkspaceId);
      if (pinned) {
        if (editor.innerHTML !== sanitizeHTML(pinned.contentHTML || "")) editor.innerHTML = sanitizeHTML(pinned.contentHTML || "");
        updateDateLabel(pinned);
      }
    });

    function onColorPaletteOutside(e) {
      if (!e.target.closest(".zen-notes-color-dot") && !e.target.closest(".zen-notes-color-palette")) colorPalette.setAttribute("data-visible", "false");
    }
    document.addEventListener("click", onColorPaletteOutside);

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
      setNumericPref(PREF_HEIGHT, clampHeight(Math.round(widget.getBoundingClientRect().height)));
    }
    dragBar.addEventListener("mousedown", (e) => {
      if (widget.getAttribute("data-collapsed") === "true") return;
      isDragging = true;
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
    window.addEventListener("resize", () => { if (popoverOpen) positionPopover(); });

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

    const prefObserver = { observe(subject, topic, data) { if (topic === "nsPref:changed" && data === PREF_ACTIVE_WORKSPACE) requeryWorkspace(); } };
    Services.prefs.addObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
    window.addEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
    window.addEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);

    const autoSaveInterval = setInterval(() => { if (pendingSave) { flushPendingSave(); renderManager(); } }, AUTO_SAVE_INTERVAL);

    /* ── Cleanup ──────────────────────────────────────────────── */
    widget._zenNotesCleanup = () => {
      flushPendingSave();
      resizeObserver.disconnect();
      sidebarObserver.disconnect();
      window.removeEventListener("resize", positionPopover);
      workspaceObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
      window.removeEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);
      document.removeEventListener("click", onColorPaletteOutside);
      Services.prefs.removeObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
      clearInterval(autoSaveInterval);
      if (saveTimeout) clearTimeout(saveTimeout);
      if (workspaceRequeryTimeout) clearTimeout(workspaceRequeryTimeout);
      if (managerOverlay && managerOverlay.parentNode) managerOverlay.parentNode.removeChild(managerOverlay);
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
      if (dragBar && dragBar.parentNode) dragBar.parentNode.removeChild(dragBar);
    };

    renderAll();
  }

  function createWidgetSafe() { try { createWidget(); } catch (e) { console.error("[ZenNotes] Failed to initialize widget:", e); } }
  function init() {
    console.info("[ZenNotes] v" + VERSION + " loaded");
    if (document.readyState === "complete" || document.readyState === "interactive") createWidgetSafe();
    else window.addEventListener("DOMContentLoaded", createWidgetSafe, { once: true });
  }
  function cleanup() {
    const widget = document.getElementById("zen-notes-widget");
    if (widget && widget._zenNotesCleanup) widget._zenNotesCleanup();
  }
  window.addEventListener("unload", cleanup, { once: true });
  init();
})();
