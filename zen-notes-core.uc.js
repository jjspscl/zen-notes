// ==UserScript==
// @name            Zen Notes Core
// @version         2.4.1
// @description     Storage, prefs, state model, migration, and shared utilities for Zen Notes
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
  const PREF_PRESET = "zen.notes.preset";
  const PREF_SHOW_WORKSPACE_KEY = "zen.notes.showWorkspaceKey";
  const PREF_APPEARANCE = "zen.notes.appearance";
  const PREF_ACTIVE_WORKSPACE = "zen.workspaces.active";
  const PREF_DATA_BACKUP = "zen.notes.dataBackup";
  const PREF_DEBUG_KEYNAV = "zen.notes.debugKeyNav";

  const LEGACY_PREF_CONTENT = "zen.notes.content";
  const LEGACY_PREF_COLOR = "zen.notes.color";
  const LEGACY_PREF_LAST_EDITED = "zen.notes.lastEdited";

  /* ── Constants ─────────────────────────────────────────────── */
  const SCHEMA_VERSION = 4;
  const VERSION = "2.4.1";

  const DEFAULT_HEIGHT = 220;
  const MIN_HEIGHT = 190;
  const MAX_HEIGHT = 460;
  const PRESETS = ["catppuccin-latte", "catppuccin-frappe", "catppuccin-macchiato", "catppuccin-mocha", "dracula", "nord", "gruvbox-dark", "gruvbox-light", "tokyo-night", "rose-pine", "rose-pine-dawn", "solarized-dark", "solarized-light", "everforest-dark", "everforest-light"];
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

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "DIV", "P", "UL", "OL", "LI", "A"]);
  const ALLOWED_HREF_SCHEMES = ["http:", "https:", "mailto:"];
  const CHECKLIST_ATTR = "data-checklist";
  const MAX_LIST_DEPTH = 4;
  const MARKDOWN_SHORTCUTS = Object.freeze({
    "-": "insertUnorderedList",
    "*": "insertUnorderedList",
    "1.": "insertOrderedList",
    "[]": "checklist",
    "[ ]": "checklist",
  });
  const CARET_NAV_KEYS = Object.freeze(new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]));
  const CARET_NAV_MOVES = Object.freeze({
    ArrowLeft: ["left", "character"],
    ArrowRight: ["right", "character"],
    ArrowUp: ["backward", "line"],
    ArrowDown: ["forward", "line"],
    Home: ["backward", "lineboundary"],
    End: ["forward", "lineboundary"],
    PageUp: ["backward", "line"],
    PageDown: ["forward", "line"],
  });
  const CARET_NAV_WORD_MOVES = Object.freeze({
    ArrowLeft: ["left", "word"],
    ArrowRight: ["right", "word"],
  });
  const PAGE_NAV_LINE_COUNT = 10;

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
  let scratchDocument = null;
  function getScratchDocument() {
    if (!scratchDocument) {
      try { scratchDocument = document.implementation.createHTMLDocument(""); } catch (e) { scratchDocument = null; }
    }
    return scratchDocument;
  }
  function createScratchElement(tag) {
    const doc = getScratchDocument();
    return doc ? doc.createElement(tag) : createXHTMLElement(tag);
  }
  function nowISOString() { return new Date().toISOString(); }
  function getDefaultColor() {
    return getPrefString(PREF_DEFAULT_COLOR, "yellow");
  }
  function createId(prefix) {
    if (Services.uuid && typeof Services.uuid.generateUUID === "function") {
      return `${prefix}-${Services.uuid.generateUUID().toString().replace(/[{}]/g, "")}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function clampHeight(height) { return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height)); }

  const LEGACY_XMLNS_PATTERN = /\s+xmlns(:[a-zA-Z0-9_-]+)?\s*=\s*("[^"]*"|'[^']*')/g;
  function stripLegacyNamespaceAttrs(html) {
    return typeof html === "string" ? html.replace(LEGACY_XMLNS_PATTERN, "") : "";
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

  /* ── State model ──────────────────────────────────────────── */
  function createNote(title, overrides = {}) {
    const color = overrides.color || getDefaultColor();
    const timestamp = nowISOString();
    return {
      id: overrides.id || createId("note"),
      title: getDisplayTitle(title || overrides.title),
      contentHTML: overrides.contentHTML || "",
      color,
      createdAt: overrides.createdAt || timestamp,
      updatedAt: overrides.updatedAt || timestamp,
      legacyLastEditedLabel: overrides.legacyLastEditedLabel || "",
      order: typeof overrides.order === "number" ? overrides.order : 0,
    };
  }

  function updateNote(state, updater) {
    if (!state.note) return null;
    updater(state.note);
    persistState(state);
    return state.note;
  }

  function createInitialV4State(initialWorkspaceId) {
    const wsId = initialWorkspaceId || DEFAULT_WORKSPACE_ID;
    const legacyContent = getPrefString(LEGACY_PREF_CONTENT, "");
    const legacyLastEditedLabel = getPrefString(LEGACY_PREF_LAST_EDITED, "");
    const hasLegacyContent = Boolean(legacyContent || legacyLastEditedLabel);
    const note = createNote("Zen Notes", { color: getDefaultColor() });
    if (hasLegacyContent) {
      note.contentHTML = legacyContent;
      note.updatedAt = nowISOString();
      note.legacyLastEditedLabel = legacyLastEditedLabel;
    }
    return {
      version: SCHEMA_VERSION,
      lastMigratedAt: nowISOString(),
      note,
      lastWorkspaceId: wsId,
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
    if (!state || typeof state !== "object") {
      if (serialized) setPrefString(PREF_DATA_BACKUP, serialized);
      state = createInitialV4State(initialWorkspaceId);
      persistState(state);
      return state;
    }
    if (state.version !== SCHEMA_VERSION || !state.note || typeof state.note !== "object") {
      if (serialized) setPrefString(PREF_DATA_BACKUP, serialized);
      state = createInitialV4State(initialWorkspaceId);
      persistState(state);
      return state;
    }
    let changed = false;
    if (!state.lastWorkspaceId) { state.lastWorkspaceId = initialWorkspaceId || DEFAULT_WORKSPACE_ID; changed = true; }
    if (changed) persistState(state);
    return state;
  }

  /* ── Export to shared namespace ────────────────────────────── */
  window.ZenNotes = {
    PREF_DATA, PREF_SCHEMA_VERSION, PREF_COLLAPSED, PREF_HEIGHT,
    PREF_DEFAULT_COLOR, PREF_PRESET,
    PREF_SHOW_WORKSPACE_KEY, PREF_APPEARANCE, PREF_ACTIVE_WORKSPACE,
    PREF_DATA_BACKUP, PREF_DEBUG_KEYNAV,
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
  };
})();
