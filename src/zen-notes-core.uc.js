// ==UserScript==
// @name            Zen Notes Core
// @version         2.6.0-beta.1
// @description     Storage, prefs, state model, migration, and shared utilities for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(() => {
  /* ── Preference keys ───────────────────────────────────────── */
  const PREF_DATA = "zen.notes.data"; // v4 HTML mirror kept for 2.4.x rollback (deprecated; removed in 2.6)
  const PREF_SCHEMA_VERSION = "zen.notes.schemaVersion";
  const PREF_COLLAPSED = "zen.notes.collapsed";
  const PREF_HEIGHT = "zen.notes.height";
  const PREF_PRESET = "zen.notes.preset";
  const PREF_DATA_BACKUP = "zen.notes.dataBackup";
  /** Preferences from removed features; cleared once at startup. */
  const DEPRECATED_PREFS = [
    "zen.notes.showWorkspaceKey",
    "zen.notes.defaultColor",
    "zen.notes.debugKeyNav",
    "zen.notes.color",
    "zen.notes.lastEdited",
    "zen.notes.appearance",
  ];

  /* ── Constants ─────────────────────────────────────────────── */
  const SCHEMA_VERSION = 5;
  const VERSION = "2.6.0-beta.1";

  const DEFAULT_HEIGHT = 220;
  const MIN_HEIGHT = 190;
  const MAX_HEIGHT = 460;
  /** Single source of truth for palettes: [id, label, color scheme]. CSS blocks and preferences.json must match (tested). */
  const PALETTES = Object.freeze([
    Object.freeze(["sticky", "Sticky note (yellow)", "light"]),
    Object.freeze(["sticky-dark", "Sticky note (amber, dark)", "dark"]),
    Object.freeze(["catppuccin-latte", "Catppuccin Latte", "light"]),
    Object.freeze(["catppuccin-frappe", "Catppuccin Frappé", "dark"]),
    Object.freeze(["catppuccin-macchiato", "Catppuccin Macchiato", "dark"]),
    Object.freeze(["catppuccin-mocha", "Catppuccin Mocha", "dark"]),
    Object.freeze(["dracula", "Dracula", "dark"]),
    Object.freeze(["nord", "Nord", "dark"]),
    Object.freeze(["gruvbox-dark", "Gruvbox Dark", "dark"]),
    Object.freeze(["gruvbox-light", "Gruvbox Light", "light"]),
    Object.freeze(["tokyo-night", "Tokyo Night", "dark"]),
    Object.freeze(["rose-pine", "Rosé Pine", "dark"]),
    Object.freeze(["rose-pine-dawn", "Rosé Pine Dawn", "light"]),
    Object.freeze(["solarized-dark", "Solarized Dark", "dark"]),
    Object.freeze(["solarized-light", "Solarized Light", "light"]),
    Object.freeze(["everforest-dark", "Everforest Dark", "dark"]),
    Object.freeze(["everforest-light", "Everforest Light", "light"]),
  ]);
  const DEFAULT_PRESET = "sticky";
  const PRESETS = PALETTES.map(([id]) => id);
  const SCROLL_BOTTOM_TOLERANCE = 2;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  const ALLOWED_HREF_SCHEMES = ["http:", "https:", "mailto:"];
  const CHECKLIST_ATTR = "data-checklist";
  const MAX_BLOCK_INDENT = 5;
  const CARET_NAV_KEYS = Object.freeze(
    new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]),
  );
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
  const prefs = () => Services.prefs;
  function getPrefString(key, defaultValue = "") {
    try {
      return prefs().getStringPref(key, defaultValue);
    } catch (_) {
      return defaultValue;
    }
  }
  function setPrefString(key, value) {
    try {
      prefs().setStringPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }
  function getPrefBool(key, defaultValue = false) {
    try {
      return prefs().getBoolPref(key, defaultValue);
    } catch (_) {
      return defaultValue;
    }
  }
  function setPrefBool(key, value) {
    try {
      prefs().setBoolPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }
  /** Reads an int pref, tolerating Sine's string-typed number inputs. */
  function getNumericPref(key, defaultValue = 0) {
    try {
      return prefs().getIntPref(key);
    } catch (_) {}
    const parsed = Number.parseInt(getPrefString(key, ""), 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  function setNumericPref(key, value) {
    const normalized = Math.round(value);
    try {
      prefs().setIntPref(key, normalized);
    } catch (_) {
      setPrefString(key, String(normalized));
    }
  }
  /** Clears preferences left behind by removed features. */
  function cleanupDeprecatedPrefs() {
    for (const key of DEPRECATED_PREFS) {
      try {
        if (prefs().prefHasUserValue(key)) prefs().clearUserPref(key);
      } catch (_) {}
    }
  }
  /** Returns a valid preset id; unknown or unset values fall back to the sticky default. */
  function resolvePreset(value) {
    return PRESETS.includes(value) ? value : DEFAULT_PRESET;
  }
  /** "light" or "dark": the colour scheme of a palette (drives color-scheme in CSS). */
  function schemeOf(preset) {
    return PALETTES.find(([id]) => id === resolvePreset(preset))[2];
  }

  /* ── General helpers ───────────────────────────────────────── */
  const createXHTMLElement = (tag) => document.createElementNS(XHTML_NS, tag);
  const createXULElement = (tag) => document.createElementNS(XUL_NS, tag);
  let scratchDocument = null;
  /** Inert document for parsing untrusted HTML without running or loading anything. */
  function createScratchElement(tag) {
    if (!scratchDocument) {
      try {
        scratchDocument = document.implementation.createHTMLDocument("");
      } catch (_) {}
    }
    return scratchDocument ? scratchDocument.createElement(tag) : createXHTMLElement(tag);
  }
  const nowISOString = () => new Date().toISOString();
  function createId(prefix) {
    if (Services.uuid && typeof Services.uuid.generateUUID === "function") {
      return `${prefix}-${Services.uuid.generateUUID().toString().replace(/[{}]/g, "")}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  const clampHeight = (height) => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));

  const LEGACY_XMLNS_PATTERN = /\s+xmlns(:[a-zA-Z0-9_-]+)?\s*=\s*("[^"]*"|'[^']*')/g;
  function stripLegacyNamespaceAttrs(html) {
    return typeof html === "string" ? html.replace(LEGACY_XMLNS_PATTERN, "") : "";
  }

  function formatDate(isoString) {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {
      return "";
    }
  }
  function formatFooterMeta(dateLabel, text) {
    const trimmed = String(text || "").trim();
    const parts = [];
    if (dateLabel) parts.push(`Edited ${dateLabel}`);
    if (trimmed) {
      const words = trimmed.split(/\s+/).length;
      parts.push(`${words} ${words === 1 ? "word" : "words"}`);
    }
    return parts.join(" · ");
  }
  const getDisplayTitle = (title) => String(title || "").trim() || "Untitled note";

  /* ── State model ──────────────────────────────────────────── */
  function createNote(title, overrides = {}) {
    const timestamp = nowISOString();
    return {
      id: overrides.id || createId("note"),
      title: getDisplayTitle(title || overrides.title),
      createdAt: overrides.createdAt || timestamp,
      updatedAt: overrides.updatedAt || timestamp,
    };
  }

  /* ── Export to shared namespace ────────────────────────────── */
  window.ZenNotes = {
    PREF_DATA,
    PREF_SCHEMA_VERSION,
    PREF_COLLAPSED,
    PREF_HEIGHT,
    PREF_PRESET,
    PREF_DATA_BACKUP,
    SCHEMA_VERSION,
    VERSION,
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
    MAX_HEIGHT,
    DEFAULT_PRESET,
    PALETTES,
    PRESETS,
    SCROLL_BOTTOM_TOLERANCE,
    XHTML_NS,
    XUL_NS,
    ALLOWED_HREF_SCHEMES,
    CHECKLIST_ATTR,
    MAX_BLOCK_INDENT,
    CARET_NAV_KEYS,
    CARET_NAV_MOVES,
    CARET_NAV_WORD_MOVES,
    PAGE_NAV_LINE_COUNT,
    getPrefString,
    setPrefString,
    getPrefBool,
    setPrefBool,
    getNumericPref,
    setNumericPref,
    cleanupDeprecatedPrefs,
    resolvePreset,
    schemeOf,
    createXHTMLElement,
    createXULElement,
    createScratchElement,
    nowISOString,
    createId,
    clampHeight,
    stripLegacyNamespaceAttrs,
    formatDate,
    formatFooterMeta,
    getDisplayTitle,
    createNote,
  };
})();
