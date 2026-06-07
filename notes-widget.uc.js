// ==UserScript==
// @name            Zen Notes Widget
// @version         2.0.0-beta
// @description     Workspace-aware multi-note widget for Zen Browser sidebar
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
  const SCHEMA_VERSION = 2;
  const VERSION = "2.0.0-beta";

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

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "UL", "OL", "LI"]);

  /* ── Preference helpers ───────────────────────────────────── */
  function getPrefString(key, defaultValue = "") {
    try {
      return Services.prefs.getStringPref(key, defaultValue);
    } catch (e) {
      return defaultValue;
    }
  }

  function setPrefString(key, value) {
    try {
      Services.prefs.setStringPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }

  function getPrefBool(key, defaultValue = false) {
    try {
      return Services.prefs.getBoolPref(key, defaultValue);
    } catch (e) {
      return defaultValue;
    }
  }

  function setPrefBool(key, value) {
    try {
      Services.prefs.setBoolPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }

  function getPrefInt(key, defaultValue = 0) {
    try {
      return Services.prefs.getIntPref(key, defaultValue);
    } catch (e) {
      return defaultValue;
    }
  }

  function getNumericPref(key, defaultValue = 0) {
    const intValue = getPrefInt(key, Number.NaN);
    if (!Number.isNaN(intValue)) {
      return intValue;
    }

    const stringValue = getPrefString(key, "");
    const parsed = parseInt(stringValue, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  function setPrefInt(key, value) {
    try {
      Services.prefs.setIntPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }

  function setNumericPref(key, value) {
    const normalized = Math.round(value);
    try {
      Services.prefs.setIntPref(key, normalized);
      return;
    } catch (e) {}

    setPrefString(key, String(normalized));
  }

  /* ── General helpers ───────────────────────────────────────── */
  function createXHTMLElement(tag) {
    return document.createElementNS(XHTML_NS, tag);
  }

  function createXULElement(tag) {
    return document.createElementNS(XUL_NS, tag);
  }

  function nowISOString() {
    return new Date().toISOString();
  }

  function isColorValid(color) {
    return COLORS.includes(color);
  }

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

  function clampHeight(height) {
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));
  }

  function sanitizeHTML(html) {
    const source = createXHTMLElement("div");
    const target = createXHTMLElement("div");
    source.innerHTML = html || "";

    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || "");
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const tagName = node.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        for (const child of node.childNodes) {
          const safeChild = sanitizeNode(child);
          if (safeChild) {
            fragment.appendChild(safeChild);
          }
        }
        return fragment;
      }

      const safeElement = createXHTMLElement(tagName.toLowerCase());
      for (const child of node.childNodes) {
        const safeChild = sanitizeNode(child);
        if (safeChild) {
          safeElement.appendChild(safeChild);
        }
      }
      return safeElement;
    }

    for (const child of source.childNodes) {
      const safeChild = sanitizeNode(child);
      if (safeChild) {
        target.appendChild(safeChild);
      }
    }

    return target.innerHTML;
  }

  function formatDate(isoString) {
    if (!isoString) {
      return "";
    }
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return "";
    }
  }

  function formatNoteEditedLabel(note) {
    if (!note) {
      return "";
    }
    if (note.updatedAt) {
      return formatDate(note.updatedAt);
    }
    return note.legacyLastEditedLabel || "";
  }

  function getDisplayTitle(title) {
    const cleaned = String(title || "").trim();
    return cleaned || "Untitled note";
  }

  function getNextNoteTitle(notes) {
    return `Note ${notes.length + 1}`;
  }

  function getWorkspaceDebugLabel(workspaceContext) {
    if (!workspaceContext) {
      return DEFAULT_WORKSPACE_LABEL;
    }
    const showKey = getPrefBool(PREF_SHOW_WORKSPACE_KEY, false);
    if (!showKey) {
      return DEFAULT_WORKSPACE_LABEL;
    }
    return `${DEFAULT_WORKSPACE_LABEL}: ${workspaceContext.id} (${workspaceContext.source})`;
  }

  /* ── Workspace resolution ──────────────────────────────────── */
  function resolveWorkspaceContext() {
    try {
      const activeWorkspace = window.gZenWorkspaces && window.gZenWorkspaces.activeWorkspace;
      if (activeWorkspace) {
        const workspaceId =
          typeof activeWorkspace === "string"
            ? activeWorkspace
            : activeWorkspace.id || activeWorkspace.uuid || activeWorkspace.key || "";
        if (workspaceId) {
          return { id: String(workspaceId), source: "gZenWorkspaces", verified: true };
        }
      }
    } catch (e) {}

    try {
      const prefWorkspace = getPrefString(PREF_ACTIVE_WORKSPACE, "");
      if (prefWorkspace) {
        return { id: prefWorkspace, source: "pref", verified: true };
      }
    } catch (e) {}

    const activeWorkspaceNode = document.querySelector("zen-workspace[active]");
    if (activeWorkspaceNode && activeWorkspaceNode.id) {
      return { id: activeWorkspaceNode.id, source: "zen-workspace[active]", verified: true };
    }

    const activeWorkspaceButton = document.querySelector("#zen-workspaces-button toolbarbutton[active='true']");
    if (activeWorkspaceButton) {
      const buttonId =
        activeWorkspaceButton.getAttribute("data-workspace-id") ||
        activeWorkspaceButton.getAttribute("workspace-id") ||
        activeWorkspaceButton.id;
      if (buttonId) {
        return { id: buttonId, source: "workspace-button", verified: false };
      }
    }

    return { id: DEFAULT_WORKSPACE_ID, source: "fallback", verified: false };
  }

  function extractWorkspaceIdFromEvent(event) {
    if (!event || !event.detail) {
      return "";
    }

    const detail = event.detail;
    const candidates = [detail.activeWorkspace, detail.workspace, detail.id, detail.activeIndex];
    for (const candidate of candidates) {
      if (!candidate && candidate !== 0) {
        continue;
      }
      if (typeof candidate === "string") {
        return candidate;
      }
      if (typeof candidate === "object") {
        const objectId = candidate.id || candidate.uuid || candidate.key || "";
        if (objectId) {
          return String(objectId);
        }
      }
    }
    return "";
  }

  /* ── State model ───────────────────────────────────────────── */
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

  function sortNotes(notes) {
    return notes.slice().sort((a, b) => a.order - b.order);
  }

  function createWorkspaceBucket(workspaceId, seedTitle) {
    const note = createNote(seedTitle || "Note 1");
    note.order = 0;
    return {
      id: workspaceId,
      activeNoteId: note.id,
      notes: [note],
    };
  }

  function normalizeNote(note, index) {
    const normalized = createNote(getDisplayTitle(note && note.title), {
      id: note && note.id,
      contentHTML: note && note.contentHTML,
      color: note && note.color,
      createdAt: note && note.createdAt,
      updatedAt: note && note.updatedAt,
      legacyLastEditedLabel: note && note.legacyLastEditedLabel,
      order: typeof note?.order === "number" ? note.order : index,
    });
    normalized.title = getDisplayTitle(note && note.title);
    return normalized;
  }

  function normalizeWorkspaceBucket(workspaceId, workspace) {
    const rawNotes = Array.isArray(workspace && workspace.notes) ? workspace.notes : [];
    const notes = sortNotes(
      rawNotes.length > 0 ? rawNotes.map((note, index) => normalizeNote(note, index)) : [createNote("Note 1")]
    ).map((note, index) => ({ ...note, order: index }));

    const noteIds = new Set(notes.map((note) => note.id));
    const activeNoteId = noteIds.has(workspace && workspace.activeNoteId) ? workspace.activeNoteId : notes[0].id;

    return {
      id: workspaceId,
      activeNoteId,
      notes,
    };
  }

  function ensureWorkspaceBucket(state, workspaceId) {
    if (!state.workspaces[workspaceId]) {
      state.workspaces[workspaceId] = createWorkspaceBucket(workspaceId, "Note 1");
      return true;
    }

    const normalized = normalizeWorkspaceBucket(workspaceId, state.workspaces[workspaceId]);
    const changed = JSON.stringify(normalized) !== JSON.stringify(state.workspaces[workspaceId]);
    state.workspaces[workspaceId] = normalized;
    return changed;
  }

  function createLegacyMigrationState(initialWorkspaceId) {
    const workspaceId = initialWorkspaceId || DEFAULT_WORKSPACE_ID;
    const legacyContent = sanitizeHTML(getPrefString(LEGACY_PREF_CONTENT, ""));
    const legacyColor = getPrefString(LEGACY_PREF_COLOR, getDefaultColor());
    const legacyLastEditedLabel = getPrefString(LEGACY_PREF_LAST_EDITED, "");
    const hasLegacyContent = Boolean(legacyContent || legacyLastEditedLabel);
    const workspace = createWorkspaceBucket(workspaceId, hasLegacyContent ? "Migrated note" : "Note 1");
    const note = workspace.notes[0];

    note.contentHTML = legacyContent;
    note.color = isColorValid(legacyColor) ? legacyColor : getDefaultColor();
    note.updatedAt = hasLegacyContent ? nowISOString() : note.updatedAt;
    note.legacyLastEditedLabel = legacyLastEditedLabel;

    return {
      version: SCHEMA_VERSION,
      lastMigratedAt: nowISOString(),
      workspaces: {
        [workspaceId]: workspace,
      },
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
      try {
        state = JSON.parse(serialized);
      } catch (e) {
        console.warn("[ZenNotes] Failed to parse v2 state. Rebuilding from legacy prefs.", e);
      }
    }

    if (!state || typeof state !== "object") {
      if (serialized) {
        setPrefString(PREF_DATA_BACKUP, serialized);
      }
      state = createLegacyMigrationState(initialWorkspaceId);
      persistState(state);
      return state;
    }

    if (state.version !== SCHEMA_VERSION || !state.workspaces || typeof state.workspaces !== "object") {
      setPrefString(PREF_DATA_BACKUP, serialized);
      state = createLegacyMigrationState(initialWorkspaceId);
      persistState(state);
      return state;
    }

    let changed = false;
    for (const workspaceId of Object.keys(state.workspaces)) {
      const normalized = normalizeWorkspaceBucket(workspaceId, state.workspaces[workspaceId]);
      if (JSON.stringify(normalized) !== JSON.stringify(state.workspaces[workspaceId])) {
        state.workspaces[workspaceId] = normalized;
        changed = true;
      }
    }

    if (ensureWorkspaceBucket(state, initialWorkspaceId || DEFAULT_WORKSPACE_ID)) {
      changed = true;
    }

    if (changed) {
      persistState(state);
    }

    return state;
  }

  function getWorkspaceBucket(state, workspaceId) {
    ensureWorkspaceBucket(state, workspaceId);
    return state.workspaces[workspaceId];
  }

  function getActiveNote(bucket) {
    return bucket.notes.find((note) => note.id === bucket.activeNoteId) || bucket.notes[0] || null;
  }

  function setActiveNoteId(state, workspaceId, noteId) {
    const bucket = getWorkspaceBucket(state, workspaceId);
    if (bucket.notes.some((note) => note.id === noteId)) {
      bucket.activeNoteId = noteId;
      persistState(state);
    }
  }

  function updateNote(state, workspaceId, noteId, updater) {
    const bucket = getWorkspaceBucket(state, workspaceId);
    const note = bucket.notes.find((item) => item.id === noteId);
    if (!note) {
      return null;
    }
    updater(note, bucket);
    persistState(state);
    return note;
  }

  function createNoteInWorkspace(state, workspaceId) {
    const bucket = getWorkspaceBucket(state, workspaceId);
    const note = createNote(getNextNoteTitle(bucket.notes), {
      order: bucket.notes.length,
      color: getDefaultColor(),
    });
    bucket.notes.push(note);
    bucket.activeNoteId = note.id;
    persistState(state);
    return note;
  }

  function moveNoteInWorkspace(state, workspaceId, noteId, direction) {
    const bucket = getWorkspaceBucket(state, workspaceId);
    const index = bucket.notes.findIndex((note) => note.id === noteId);
    if (index < 0) {
      return;
    }

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= bucket.notes.length) {
      return;
    }

    const nextNotes = bucket.notes.slice();
    const [note] = nextNotes.splice(index, 1);
    nextNotes.splice(nextIndex, 0, note);
    bucket.notes = nextNotes.map((item, order) => ({ ...item, order }));
    persistState(state);
  }

  function deleteNoteFromWorkspace(state, workspaceId, noteId) {
    const bucket = getWorkspaceBucket(state, workspaceId);
    const index = bucket.notes.findIndex((note) => note.id === noteId);
    if (index < 0) {
      return;
    }

    bucket.notes.splice(index, 1);
    if (bucket.notes.length === 0) {
      const replacement = createNote("Note 1", { order: 0 });
      bucket.notes.push(replacement);
      bucket.activeNoteId = replacement.id;
    } else {
      bucket.notes = bucket.notes.map((note, order) => ({ ...note, order }));
      if (bucket.activeNoteId === noteId) {
        const fallback = bucket.notes[Math.min(index, bucket.notes.length - 1)] || bucket.notes[0];
        bucket.activeNoteId = fallback.id;
      }
    }

    persistState(state);
  }

  /* ── Widget builder ────────────────────────────────────────── */
  function createWidget() {
    if (document.getElementById("zen-notes-widget")) {
      return;
    }

    const tabsToolbar = document.getElementById("TabsToolbar");
    const footButtons = document.getElementById("zen-sidebar-foot-buttons");
    if (!tabsToolbar || !footButtons) {
      console.warn(
        "[ZenNotes] Could not find sidebar injection point. Widget not loaded. Zen Browser may have changed its DOM structure."
      );
      return;
    }

    let workspaceContext = resolveWorkspaceContext();
    let state = loadState(workspaceContext.id);
    let currentWorkspaceId = workspaceContext.id;
    let saveTimeout = null;
    let pendingSave = null;

    const widget = createXULElement("vbox");
    widget.id = "zen-notes-widget";
    widget.setAttribute("flex", "0");

    const isCollapsed = getPrefBool(PREF_COLLAPSED, false);
    widget.setAttribute("data-collapsed", isCollapsed ? "true" : "false");
    if (!isCollapsed) {
      widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;
    }

    const header = createXULElement("hbox");
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    header.setAttribute("aria-label", "Notes widget");

    const titleGroup = createXHTMLElement("div");
    titleGroup.className = "zen-notes-title-group";

    const titleLabel = createXHTMLElement("span");
    titleLabel.className = "zen-notes-title-label";
    titleLabel.textContent = "Notes";

    const noteSelect = createXHTMLElement("select");
    noteSelect.className = "zen-notes-select";
    noteSelect.setAttribute("aria-label", "Switch notes");

    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(noteSelect);

    const headerActions = createXULElement("hbox");
    headerActions.className = "zen-notes-header-actions";

    const quickNewBtn = createXHTMLElement("button");
    quickNewBtn.className = "zen-notes-icon-btn";
    quickNewBtn.textContent = "+";
    quickNewBtn.setAttribute("title", "Create note");
    quickNewBtn.setAttribute("aria-label", "Create note");

    const managerBtn = createXHTMLElement("button");
    managerBtn.className = "zen-notes-icon-btn";
    managerBtn.textContent = "≡";
    managerBtn.setAttribute("title", "Manage notes");
    managerBtn.setAttribute("aria-label", "Manage notes");

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
        const bucket = getWorkspaceBucket(state, currentWorkspaceId);
        const activeNote = getActiveNote(bucket);
        if (!activeNote) {
          return;
        }
        updateNote(state, currentWorkspaceId, activeNote.id, (note) => {
          note.color = color;
          note.updatedAt = nowISOString();
          note.legacyLastEditedLabel = "";
        });
        colorPalette.setAttribute("data-visible", "false");
        renderAll();
      });
      colorPalette.appendChild(swatch);
    });

    colorDot.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentlyVisible = colorPalette.getAttribute("data-visible") === "true";
      if (!currentlyVisible) {
        const activeNote = getActiveNote(getWorkspaceBucket(state, currentWorkspaceId));
        if (activeNote) {
          const activeSwatch = colorPalette.querySelector(`[data-color="${activeNote.color}"]`);
          if (activeSwatch) {
            colorPalette.appendChild(activeSwatch);
          }
        }
      }
      colorPalette.setAttribute("data-visible", currentlyVisible ? "false" : "true");
    });

    const toggle = createXHTMLElement("span");
    toggle.className = "zen-notes-toggle";
    toggle.setAttribute("aria-hidden", "true");

    headerActions.appendChild(quickNewBtn);
    headerActions.appendChild(managerBtn);
    headerActions.appendChild(colorDot);
    headerActions.appendChild(colorPalette);
    headerActions.appendChild(toggle);

    header.appendChild(titleGroup);
    header.appendChild(headerActions);

    const body = createXHTMLElement("div");
    body.className = "zen-notes-body";

    const toolbar = createXHTMLElement("div");
    toolbar.className = "zen-notes-toolbar";

    function createToolbarButton(label, title, command) {
      const button = createXHTMLElement("button");
      button.className = "zen-notes-toolbar-btn";
      button.textContent = label;
      button.setAttribute("title", title);
      button.setAttribute("aria-label", title);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("data-command", command);
      return button;
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

    const managerOverlay = createXHTMLElement("div");
    managerOverlay.id = "zen-notes-manager-overlay";
    managerOverlay.setAttribute("data-open", "false");

    const managerPanel = createXHTMLElement("div");
    managerPanel.className = "zen-notes-manager-panel";

    const managerPanelHeader = createXHTMLElement("div");
    managerPanelHeader.className = "zen-notes-manager-header";

    const managerTitleGroup = createXHTMLElement("div");
    managerTitleGroup.className = "zen-notes-manager-title-group";

    const managerTitle = createXHTMLElement("h2");
    managerTitle.className = "zen-notes-manager-title";
    managerTitle.textContent = "Manage notes";

    const managerSubtitle = createXHTMLElement("p");
    managerSubtitle.className = "zen-notes-manager-subtitle";

    managerTitleGroup.appendChild(managerTitle);
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

    const managerFooter = createXHTMLElement("p");
    managerFooter.className = "zen-notes-manager-footer";
    managerFooter.textContent = "Hard delete removes a note immediately after confirmation.";

    managerPanel.appendChild(managerPanelHeader);
    managerPanel.appendChild(managerList);
    managerPanel.appendChild(managerFooter);
    managerOverlay.appendChild(managerPanel);

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);
    (document.body || document.documentElement).appendChild(managerOverlay);

    function execFormat(command) {
      document.execCommand(command, false, null);
    }

    function getCurrentBucket() {
      return getWorkspaceBucket(state, currentWorkspaceId);
    }

    function getCurrentActiveNote() {
      return getActiveNote(getCurrentBucket());
    }

    function setWidgetColor(color) {
      widget.className = `zen-notes-${isColorValid(color) ? color : getDefaultColor()}`;
    }

    function updateToolbarState() {
      const states = [
        [boldBtn, "bold"],
        [italicBtn, "italic"],
        [bulletBtn, "insertUnorderedList"],
        [numberBtn, "insertOrderedList"],
      ];

      for (const [button, command] of states) {
        let active = false;
        try {
          active = document.queryCommandState(command);
        } catch (e) {}
        button.setAttribute("data-active", active ? "true" : "false");
        button.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    function updateDateLabel(note, overrideIso) {
      const label = overrideIso ? formatDate(overrideIso) : formatNoteEditedLabel(note);
      dateLabel.textContent = label ? `Last edited: ${label}` : "";
    }

    function flushPendingSave() {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      if (!pendingSave) {
        return;
      }

      const { workspaceId, noteId, html } = pendingSave;
      const sanitized = sanitizeHTML(html);
      updateNote(state, workspaceId, noteId, (note) => {
        note.contentHTML = sanitized;
        note.updatedAt = nowISOString();
        note.legacyLastEditedLabel = "";
      });
      pendingSave = null;
    }

    function scheduleSave(html) {
      const activeNote = getCurrentActiveNote();
      if (!activeNote) {
        return;
      }
      pendingSave = {
        workspaceId: currentWorkspaceId,
        noteId: activeNote.id,
        html,
      };

      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(() => {
        flushPendingSave();
        renderManager();
      }, DEBOUNCE_MS);
    }

    function flushCurrentEditorImmediately() {
      const activeNote = getCurrentActiveNote();
      if (!activeNote) {
        return;
      }
      pendingSave = {
        workspaceId: currentWorkspaceId,
        noteId: activeNote.id,
        html: editor.innerHTML || "",
      };
      flushPendingSave();
    }

    function renderNoteOptions() {
      const bucket = getCurrentBucket();
      noteSelect.textContent = "";

      for (const note of bucket.notes) {
        const option = createXHTMLElement("option");
        option.value = note.id;
        option.textContent = getDisplayTitle(note.title);
        noteSelect.appendChild(option);
      }

      noteSelect.value = bucket.activeNoteId;
    }

    function renderManager() {
      const bucket = getCurrentBucket();
      const activeNote = getActiveNote(bucket);
      managerSubtitle.textContent = `${getWorkspaceDebugLabel(workspaceContext)} · ${bucket.notes.length} note${bucket.notes.length === 1 ? "" : "s"}`;
      managerList.textContent = "";

      bucket.notes.forEach((note, index) => {
        const row = createXHTMLElement("div");
        row.className = "zen-notes-manager-note";
        row.setAttribute("data-active", note.id === activeNote.id ? "true" : "false");
        row.addEventListener("click", () => {
          flushCurrentEditorImmediately();
          bucket.activeNoteId = note.id;
          persistState(state);
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
          updateNote(state, currentWorkspaceId, note.id, (currentNote) => {
            currentNote.title = getDisplayTitle(titleInput.value);
            currentNote.updatedAt = nowISOString();
            currentNote.legacyLastEditedLabel = "";
          });
          renderNoteOptions();
        });
        titleInput.addEventListener("blur", () => {
          titleInput.value = getDisplayTitle(titleInput.value);
          renderNoteOptions();
        });

        const noteMeta = createXHTMLElement("span");
        noteMeta.className = "zen-notes-manager-note-meta";
        noteMeta.textContent = formatNoteEditedLabel(note)
          ? `Last edited ${formatNoteEditedLabel(note)}`
          : "Empty note";

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
          bucket.activeNoteId = note.id;
          persistState(state);
          renderAll();
          managerOverlay.setAttribute("data-open", "false");
          setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
        });

        const upBtn = createXHTMLElement("button");
        upBtn.className = "zen-notes-manager-action-btn";
        upBtn.textContent = "↑";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveNoteInWorkspace(state, currentWorkspaceId, note.id, "up");
          renderAll();
        });

        const downBtn = createXHTMLElement("button");
        downBtn.className = "zen-notes-manager-action-btn";
        downBtn.textContent = "↓";
        downBtn.disabled = index === bucket.notes.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveNoteInWorkspace(state, currentWorkspaceId, note.id, "down");
          renderAll();
        });

        const deleteBtn = createXHTMLElement("button");
        deleteBtn.className = "zen-notes-manager-danger-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const confirmed = Services.prompt.confirm(
            window,
            "Delete note?",
            `Delete “${getDisplayTitle(note.title)}” permanently? This cannot be undone.`
          );
          if (!confirmed) {
            return;
          }
          flushCurrentEditorImmediately();
          deleteNoteFromWorkspace(state, currentWorkspaceId, note.id);
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
      const bucket = getCurrentBucket();
      const activeNote = getActiveNote(bucket);
      if (!activeNote) {
        return;
      }

      renderNoteOptions();
      setWidgetColor(activeNote.color);
      editor.innerHTML = sanitizeHTML(activeNote.contentHTML || "");
      updateDateLabel(activeNote);
      updateToolbarState();
    }

    function renderAll() {
      renderActiveNote();
      renderManager();
    }

    function createAndActivateNote() {
      flushCurrentEditorImmediately();
      createNoteInWorkspace(state, currentWorkspaceId);
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
      const resolvedWorkspaceId = nextWorkspaceId || DEFAULT_WORKSPACE_ID;
      if (resolvedWorkspaceId === currentWorkspaceId && source === workspaceContext.source) {
        return;
      }
      flushCurrentEditorImmediately();
      currentWorkspaceId = resolvedWorkspaceId;
      workspaceContext = {
        id: resolvedWorkspaceId,
        source: source || workspaceContext.source,
        verified: resolvedWorkspaceId !== DEFAULT_WORKSPACE_ID,
      };
      ensureWorkspaceBucket(state, currentWorkspaceId);
      persistState(state);
      renderAll();
    }

    function requeryWorkspace() {
      const nextContext = resolveWorkspaceContext();
      syncWorkspace(nextContext.id, nextContext.source);
    }

    function handleToolbarCommand(command) {
      editor.focus();
      execFormat(command);
      updateToolbarState();
      scheduleSave(editor.innerHTML || "");
    }

    [boldBtn, italicBtn, bulletBtn, numberBtn].forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        handleToolbarCommand(button.getAttribute("data-command"));
      });
    });

    quickNewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      createAndActivateNote();
    });

    managerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      renderManager();
      managerOverlay.setAttribute("data-open", "true");
    });

    managerNewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      createAndActivateNote();
      renderManager();
    });

    managerCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      managerOverlay.setAttribute("data-open", "false");
    });

    managerOverlay.addEventListener("click", (e) => {
      if (e.target === managerOverlay) {
        managerOverlay.setAttribute("data-open", "false");
      }
    });

    noteSelect.addEventListener("click", (e) => e.stopPropagation());
    noteSelect.addEventListener("change", (e) => {
      e.stopPropagation();
      flushCurrentEditorImmediately();
      setActiveNoteId(state, currentWorkspaceId, noteSelect.value);
      renderAll();
      setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
    });

    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("click", updateToolbarState);

    header.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) {
        return;
      }
      if (e.target.closest(".zen-notes-color-swatch") || e.target.closest(".zen-notes-color-dot")) {
        return;
      }

      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const nextCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", nextCollapsed ? "true" : "false");
      header.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      setPrefBool(PREF_COLLAPSED, nextCollapsed);

      if (nextCollapsed) {
        widget.style.height = "";
      } else {
        widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;
        setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
      }
    });

    editor.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          handleToolbarCommand("bold");
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          handleToolbarCommand("italic");
        }
      }
      if (e.key === "Escape") {
        managerOverlay.setAttribute("data-open", "false");
        widget.setAttribute("data-collapsed", "true");
        header.setAttribute("aria-expanded", "false");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    });

    editor.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain") || "";
          document.execCommand("insertText", false, text);
          return;
        }
      }
    });

    editor.addEventListener("input", () => {
      scheduleSave(editor.innerHTML || "");
      updateDateLabel(getCurrentActiveNote(), nowISOString());
    });

    editor.addEventListener("blur", () => {
      flushCurrentEditorImmediately();
      renderManager();
      const activeNote = getCurrentActiveNote();
      if (activeNote) {
        if (editor.innerHTML !== sanitizeHTML(activeNote.contentHTML || "")) {
          editor.innerHTML = sanitizeHTML(activeNote.contentHTML || "");
        }
        updateDateLabel(activeNote);
      }
    });

    function onDocumentClick(e) {
      if (!e.target.closest(".zen-notes-color-dot") && !e.target.closest(".zen-notes-color-palette")) {
        colorPalette.setAttribute("data-visible", "false");
      }
    }

    document.addEventListener("click", onDocumentClick);

    let isDragging = false;
    let dragStartY = 0;
    let dragStartHeight = 0;

    function onMouseMove(e) {
      if (!isDragging) {
        return;
      }
      const delta = dragStartY - e.clientY;
      const nextHeight = clampHeight(dragStartHeight + delta);
      widget.style.height = `${nextHeight}px`;
    }

    function onMouseUp() {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      const height = clampHeight(Math.round(widget.getBoundingClientRect().height));
      setNumericPref(PREF_HEIGHT, height);
    }

    dragBar.addEventListener("mousedown", (e) => {
      if (widget.getAttribute("data-collapsed") === "true") {
        return;
      }
      isDragging = true;
      dragStartY = e.clientY;
      dragStartHeight = widget.getBoundingClientRect().height;
      e.preventDefault();
    });

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    function enforceWidth(width) {
      widget.style.width = `${Math.max(0, width - SIDEBAR_PADDING)}px`;
    }

    enforceWidth(tabsToolbar.getBoundingClientRect().width);

    const sidebarObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        enforceWidth(entry.contentRect.width);
      }
    });
    sidebarObserver.observe(tabsToolbar);

    const resizeObserver = new ResizeObserver((entries) => {
      if (isDragging) {
        return;
      }
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height);
        if (height >= MIN_HEIGHT && height <= MAX_HEIGHT) {
          setNumericPref(PREF_HEIGHT, height);
        }
      }
    });
    resizeObserver.observe(widget);

    function onWorkspaceEvent(event) {
      const nextId = extractWorkspaceIdFromEvent(event);
      if (nextId) {
        syncWorkspace(nextId, event.type);
      } else {
        requeryWorkspace();
      }
    }

    let workspaceRequeryTimeout = null;
    const workspaceObserver = new MutationObserver(() => {
      if (workspaceRequeryTimeout) {
        clearTimeout(workspaceRequeryTimeout);
      }
      workspaceRequeryTimeout = setTimeout(() => {
        workspaceRequeryTimeout = null;
        requeryWorkspace();
      }, 50);
    });

    const workspaceContainer = document.getElementById("tabbrowser-arrowscrollbox") || document.documentElement;
    workspaceObserver.observe(workspaceContainer, {
      subtree: true,
      attributes: true,
      attributeFilter: ["active"],
    });

    const prefObserver = {
      observe(subject, topic, data) {
        if (topic === "nsPref:changed" && data === PREF_ACTIVE_WORKSPACE) {
          requeryWorkspace();
        }
      },
    };

    Services.prefs.addObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
    window.addEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
    window.addEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);

    const autoSaveInterval = setInterval(() => {
      if (pendingSave) {
        flushPendingSave();
        renderManager();
      }
    }, AUTO_SAVE_INTERVAL);

    widget._zenNotesCleanup = () => {
      flushPendingSave();
      resizeObserver.disconnect();
      sidebarObserver.disconnect();
      workspaceObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener(WORKSPACE_EVENT_NAME, onWorkspaceEvent);
      window.removeEventListener(WORKSPACE_DATA_EVENT_NAME, onWorkspaceEvent);
      document.removeEventListener("click", onDocumentClick);
      Services.prefs.removeObserver(PREF_ACTIVE_WORKSPACE, prefObserver);
      clearInterval(autoSaveInterval);
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      if (workspaceRequeryTimeout) {
        clearTimeout(workspaceRequeryTimeout);
      }
      if (managerOverlay && managerOverlay.parentNode) {
        managerOverlay.parentNode.removeChild(managerOverlay);
      }
      if (dragBar && dragBar.parentNode) {
        dragBar.parentNode.removeChild(dragBar);
      }
    };

    renderAll();
  }

  function createWidgetSafe() {
    try {
      createWidget();
    } catch (e) {
      console.error("[ZenNotes] Failed to initialize widget:", e);
    }
  }

  function init() {
    console.info("[ZenNotes] v" + VERSION + " loaded");
    if (document.readyState === "complete" || document.readyState === "interactive") {
      createWidgetSafe();
    } else {
      window.addEventListener("DOMContentLoaded", createWidgetSafe, { once: true });
    }
  }

  function cleanup() {
    const widget = document.getElementById("zen-notes-widget");
    if (widget && widget._zenNotesCleanup) {
      widget._zenNotesCleanup();
    }
  }

  window.addEventListener("unload", cleanup, { once: true });

  init();
})();
