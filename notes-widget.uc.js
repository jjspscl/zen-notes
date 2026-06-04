// ==UserScript==
// @name            Zen Notes Widget
// @version         0.2.1-alpha
// @description     Persistent sticky-note widget in Zen Browser sidebar
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  /* ── Constants ───────────────────────────────────────────── */
  const PREF_CONTENT = "zen.notes.content";
  const PREF_COLLAPSED = "zen.notes.collapsed";
  const PREF_HEIGHT = "zen.notes.height";
  const PREF_COLOR = "zen.notes.color";
  const PREF_LAST_EDITED = "zen.notes.lastEdited";

  const DEFAULT_HEIGHT = 200;
  const MIN_HEIGHT = 100;
  const MAX_HEIGHT = 400;
  const DEFAULT_COLOR = "yellow";
  const COLORS = ["yellow", "orange", "purple", "green", "blue"];

  // Timing
  const DEBOUNCE_MS = 300;     // ms between keystrokes before saving to prefs
  const FOCUS_DELAY_MS = 50;   // ms before focusing editor on expand (DOM reflow)
  const AUTO_SAVE_INTERVAL = 5000; // periodic save in case of crash

  // Layout
  const SIDEBAR_MARGIN = 8;    // px on each side
  const SIDEBAR_PADDING = SIDEBAR_MARGIN * 2; // total horizontal padding

  // Version banner
  const VERSION = "0.2.2-alpha";

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

  function setPrefInt(key, value) {
    try {
      Services.prefs.setIntPref(key, value);
    } catch (e) {
      console.error("[ZenNotes] failed to save pref", key, e);
    }
  }

  function getFormattedDate() {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /* ── Sanitization ──────────────────────────────────────────── */
  // NOTE: DOMParser-based sanitization was attempted but caused the
  // widget to fail to render. The parser strips XUL namespace info
  // needed by Firefox chrome. A safe approach (e.g. regex-based or
  // DOMPurify in content process) will be revisited post-v1.
  // For now, notes are stored in Services.prefs (local-only) and the
  // contenteditable element is in chrome context, limiting XSS vectors.
  function sanitizeHTML(html) {
    return html;
  }

  /* ── Debounced save ────────────────────────────────────────── */
  let saveTimeout = null;
  let isDirty = false;

  function debouncedSave(value) {
    isDirty = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      setPrefString(PREF_CONTENT, value);
      setPrefString(PREF_LAST_EDITED, getFormattedDate());
      isDirty = false;
    }, DEBOUNCE_MS);
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
        "[ZenNotes] Could not find sidebar injection point. " +
          "Widget not loaded. Zen Browser may have changed its DOM structure."
      );
      return;
    }

    const savedContent = getPrefString(PREF_CONTENT, "");
    const isCollapsed = getPrefBool(PREF_COLLAPSED, false);
    const savedHeight = getPrefInt(PREF_HEIGHT, DEFAULT_HEIGHT);
    const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, savedHeight));
    const savedColor = getPrefString(PREF_COLOR, DEFAULT_COLOR);
    const lastEdited = getPrefString(PREF_LAST_EDITED, "");

    const widget = document.createElementNS(
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
      "vbox"
    );
    widget.id = "zen-notes-widget";
    widget.className = "zen-notes-" + savedColor;
    widget.setAttribute("flex", "0");
    widget.setAttribute("data-collapsed", isCollapsed ? "true" : "false");
    if (!isCollapsed) {
      widget.style.height = clampedHeight + "px";
    }

    /* ── Header ──────────────────────────────────────────────── */
    const header = document.createElementNS(
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
      "hbox"
    );
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    header.setAttribute("aria-label", "Notes widget");

    const title = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    title.className = "zen-notes-title";
    title.textContent = "Notes";

    const headerActions = document.createElementNS(
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
      "hbox"
    );
    headerActions.className = "zen-notes-header-actions";

    // Color dot
    const colorDot = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    colorDot.className = "zen-notes-color-dot";
    colorDot.setAttribute("role", "button");
    colorDot.setAttribute("aria-label", "Change note color");

    // Color palette
    const colorPalette = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    colorPalette.className = "zen-notes-color-palette";
    COLORS.forEach((color) => {
      const swatch = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
      swatch.className = "zen-notes-color-swatch";
      swatch.setAttribute("data-color", color);
      swatch.setAttribute("role", "button");
      swatch.setAttribute("aria-label", color + " color");
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        widget.className = "zen-notes-" + color;
        setPrefString(PREF_COLOR, color);
        colorPalette.setAttribute("data-visible", "false");
      });
      colorPalette.appendChild(swatch);
    });

    colorDot.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentlyVisible = colorPalette.getAttribute("data-visible") === "true";
      colorPalette.setAttribute("data-visible", currentlyVisible ? "false" : "true");
    });

    // Toggle chevron
    const toggle = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    toggle.className = "zen-notes-toggle";
    toggle.setAttribute("aria-hidden", "true");

    headerActions.appendChild(colorDot);
    headerActions.appendChild(colorPalette);
    headerActions.appendChild(toggle);

    header.appendChild(title);
    header.appendChild(headerActions);

    /* ── Body ──────────────────────────────────────────────────── */
    const body = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    body.className = "zen-notes-body";

    // Toolbar
    const toolbar = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    toolbar.className = "zen-notes-toolbar";

    const boldBtn = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
    boldBtn.className = "zen-notes-toolbar-btn";
    boldBtn.textContent = "B";
    boldBtn.setAttribute("title", "Bold");
    boldBtn.setAttribute("aria-pressed", "false");

    const italicBtn = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
    italicBtn.className = "zen-notes-toolbar-btn";
    italicBtn.textContent = "I";
    italicBtn.setAttribute("title", "Italic");
    italicBtn.setAttribute("aria-pressed", "false");
    italicBtn.style.fontStyle = "italic";

    function execFormat(command, value) {
      // execCommand is deprecated but has no standard replacement
      // for bold/italic in contenteditable. See:
      // https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
      document.execCommand(command, false, value);
    }

    boldBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.focus();
      execFormat("bold");
      updateToolbarState();
    });

    italicBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.focus();
      execFormat("italic");
      updateToolbarState();
    });

    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);

    // Editor
    const editor = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    editor.className = "zen-notes-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", "Notes editor");

    if (savedContent) {
      editor.innerHTML = sanitizeHTML(savedContent);
    }

    // Date
    const dateLabel = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    dateLabel.className = "zen-notes-date";
    dateLabel.textContent = lastEdited ? "Last edited: " + lastEdited : "";

    body.appendChild(toolbar);
    body.appendChild(editor);
    body.appendChild(dateLabel);
    widget.appendChild(header);
    widget.appendChild(body);

    // External drag bar (above widget)
    const dragBar = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    dragBar.className = "zen-notes-drag-bar";

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);

    /* ── Drag-to-resize logic ────────────────────────────────── */
    let isDragging = false;
    let dragStartY = 0;
    let dragStartHeight = 0;

    function onMouseMove(e) {
      if (!isDragging) return;
      const delta = dragStartY - e.clientY; // up = positive = taller
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight + delta));
      widget.style.height = newHeight + "px";
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      const h = Math.round(widget.getBoundingClientRect().height);
      if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) {
        setPrefInt(PREF_HEIGHT, h);
      }
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

    /* ── Runtime width enforcement ───────────────────────────── */
    function enforceWidth() {
      const sidebarWidth = tabsToolbar.getBoundingClientRect().width;
      widget.style.width = Math.max(0, sidebarWidth - SIDEBAR_PADDING) + "px";
    }
    enforceWidth();

    const sidebarObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        widget.style.width = Math.max(0, w - SIDEBAR_PADDING) + "px";
      }
    });
    sidebarObserver.observe(tabsToolbar);

    /* ── Toolbar state updater ───────────────────────────────── */
    function updateToolbarState() {
      try {
        const isBold = document.queryCommandState("bold");
        const isItalic = document.queryCommandState("italic");
        boldBtn.setAttribute("data-active", isBold ? "true" : "false");
        boldBtn.setAttribute("aria-pressed", isBold ? "true" : "false");
        italicBtn.setAttribute("data-active", isItalic ? "true" : "false");
        italicBtn.setAttribute("aria-pressed", isItalic ? "true" : "false");
      } catch (e) {}
    }

    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("click", updateToolbarState);

    /* ── Collapse/expand ───────────────────────────────────────── */
    header.addEventListener("click", (e) => {
      if (
        e.target.closest(".zen-notes-editor") ||
        e.target.closest(".zen-notes-toolbar-btn") ||
        e.target.closest(".zen-notes-color-swatch")
      )
        return;

      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const newCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", newCollapsed ? "true" : "false");
      header.setAttribute("aria-expanded", newCollapsed ? "false" : "true");
      setPrefBool(PREF_COLLAPSED, newCollapsed);

      if (newCollapsed) {
        widget.style.height = "";
      } else {
        const h = getPrefInt(PREF_HEIGHT, DEFAULT_HEIGHT);
        widget.style.height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)) + "px";
        setTimeout(() => editor.focus(), FOCUS_DELAY_MS);
      }
    });

    /* ── Keyboard shortcuts ──────────────────────────────────── */
    editor.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          execFormat("bold");
          updateToolbarState();
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          execFormat("italic");
          updateToolbarState();
        }
      }
      if (e.key === "Escape") {
        widget.setAttribute("data-collapsed", "true");
        header.setAttribute("aria-expanded", "false");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    });

    /* ── Paste filter ──────────────────────────────────────────── */
    editor.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (items) {
        for (const item of items) {
          if (item.type && item.type.startsWith("image/")) {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain") || "";
            document.execCommand("insertText", false, text);
            return;
          }
        }
      }
    });

    /* ── Save on input ─────────────────────────────────────────── */
    editor.addEventListener("input", () => {
      debouncedSave(editor.innerHTML || "");
      const dateStr = getFormattedDate();
      dateLabel.textContent = "Last edited: " + dateStr;
    });

    editor.addEventListener("blur", () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      const html = editor.innerHTML || "";
      setPrefString(PREF_CONTENT, html);
      setPrefString(PREF_LAST_EDITED, getFormattedDate());
      isDirty = false;
    });

    /* ── Close palette on outside click ────────────────────────── */
    function onDocumentClick(e) {
      if (
        !e.target.closest(".zen-notes-color-dot") &&
        !e.target.closest(".zen-notes-color-palette")
      ) {
        colorPalette.setAttribute("data-visible", "false");
      }
    }
    document.addEventListener("click", onDocumentClick);

    /* ── Resize observer (with drag guard) ─────────────────────── */
    const resizeObserver = new ResizeObserver((entries) => {
      if (isDragging) return; // skip during active drag to avoid feedback loop
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) {
          setPrefInt(PREF_HEIGHT, h);
        }
      }
    });
    resizeObserver.observe(widget);

    /* ── Periodic crash-safe save ──────────────────────────────── */
    const autoSaveInterval = setInterval(() => {
      if (isDirty) {
        const html = editor.innerHTML || "";
        setPrefString(PREF_CONTENT, html);
        setPrefString(PREF_LAST_EDITED, getFormattedDate());
        isDirty = false;
      }
    }, AUTO_SAVE_INTERVAL);

    /* ── Cleanup ───────────────────────────────────────────────── */
    widget._zenNotesCleanup = () => {
      resizeObserver.disconnect();
      sidebarObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("click", onDocumentClick);
      clearInterval(autoSaveInterval);
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };

    // Initial toolbar state
    updateToolbarState();
  }

  /* ── Error boundary ──────────────────────────────────────────── */
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
