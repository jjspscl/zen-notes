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
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  let saveTimeout = null;

  function debouncedSave(value) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      setPrefString(PREF_CONTENT, value);
      setPrefString(PREF_LAST_EDITED, getFormattedDate());
    }, 300);
  }

  function createWidget() {
    if (document.getElementById("zen-notes-widget")) {
      return;
    }

    const tabsToolbar = document.getElementById("TabsToolbar");
    const footButtons = document.getElementById("zen-sidebar-foot-buttons");
    if (!tabsToolbar || !footButtons) {
      return;
    }

    const savedContent = getPrefString(PREF_CONTENT, "");
    const isCollapsed = getPrefBool(PREF_COLLAPSED, false);
    const savedHeight = getPrefInt(PREF_HEIGHT, DEFAULT_HEIGHT);
    const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, savedHeight));
    const savedColor = getPrefString(PREF_COLOR, DEFAULT_COLOR);
    const lastEdited = getPrefString(PREF_LAST_EDITED, "");

    const widget = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "vbox");
    widget.id = "zen-notes-widget";
    widget.className = "zen-notes-" + savedColor;
    widget.setAttribute("flex", "0");
    widget.setAttribute("data-collapsed", isCollapsed ? "true" : "false");
    if (!isCollapsed) {
      widget.style.height = clampedHeight + "px";
    }

    // Header
    const header = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "hbox");
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");

    const title = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    title.className = "zen-notes-title";
    title.textContent = "Notes";

    const headerActions = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "hbox");
    headerActions.className = "zen-notes-header-actions";

    // Color dot
    const colorDot = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    colorDot.className = "zen-notes-color-dot";

    // Color palette (inline, hidden by default)
    const colorPalette = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    colorPalette.className = "zen-notes-color-palette";
    COLORS.forEach((color) => {
      const swatch = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
      swatch.className = "zen-notes-color-swatch";
      swatch.setAttribute("data-color", color);
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

    headerActions.appendChild(colorDot);
    headerActions.appendChild(colorPalette);
    headerActions.appendChild(toggle);

    header.appendChild(title);
    header.appendChild(headerActions);

    // Body (HTML div for proper CSS flexbox behavior)
    const body = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    body.className = "zen-notes-body";

    // Toolbar
    const toolbar = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    toolbar.className = "zen-notes-toolbar";

    const boldBtn = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
    boldBtn.className = "zen-notes-toolbar-btn";
    boldBtn.textContent = "B";
    boldBtn.setAttribute("title", "Bold");

    const italicBtn = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
    italicBtn.className = "zen-notes-toolbar-btn";
    italicBtn.textContent = "I";
    italicBtn.setAttribute("title", "Italic");
    italicBtn.style.fontStyle = "italic";

    boldBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.focus();
      document.execCommand("bold");
      updateToolbarState();
    });

    italicBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.focus();
      document.execCommand("italic");
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

    if (savedContent) {
      editor.innerHTML = savedContent;
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

    // External drag bar (above widget, hover-only)
    const dragBar = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    dragBar.className = "zen-notes-drag-bar";

    tabsToolbar.insertBefore(widget, footButtons);
    tabsToolbar.insertBefore(dragBar, widget);

    // Drag-to-resize logic (drag bar above widget)
    let isDragging = false;
    let dragStartY = 0;
    let dragStartHeight = 0;

    dragBar.addEventListener("mousedown", (e) => {
      if (widget.getAttribute("data-collapsed") === "true") return;
      isDragging = true;
      dragStartY = e.clientY;
      dragStartHeight = widget.getBoundingClientRect().height;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const delta = dragStartY - e.clientY; // up = positive = taller
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight + delta));
      widget.style.height = newHeight + "px";
    });

    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      const h = Math.round(widget.getBoundingClientRect().height);
      if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) {
        setPrefInt(PREF_HEIGHT, h);
      }
    });

    // Runtime width enforcement: cap widget width to sidebar bounds
    function enforceWidth() {
      const sidebarWidth = tabsToolbar.getBoundingClientRect().width;
      widget.style.width = Math.max(0, sidebarWidth - 16) + "px";
    }
    enforceWidth();

    const sidebarObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        widget.style.width = Math.max(0, w - 16) + "px";
      }
    });
    sidebarObserver.observe(tabsToolbar);

    // Toolbar state updater
    function updateToolbarState() {
      try {
        const isBold = document.queryCommandState("bold");
        const isItalic = document.queryCommandState("italic");
        boldBtn.setAttribute("data-active", isBold ? "true" : "false");
        italicBtn.setAttribute("data-active", isItalic ? "true" : "false");
      } catch (e) {}
    }

    // Update toolbar on selection change
    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("click", updateToolbarState);

    // Collapse/expand
    header.addEventListener("click", (e) => {
      if (e.target.closest(".zen-notes-editor") || e.target.closest(".zen-notes-toolbar-btn") || e.target.closest(".zen-notes-color-swatch")) return;

      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const newCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", newCollapsed ? "true" : "false");
      setPrefBool(PREF_COLLAPSED, newCollapsed);

      if (newCollapsed) {
        widget.style.height = "";
      } else {
        const h = getPrefInt(PREF_HEIGHT, DEFAULT_HEIGHT);
        widget.style.height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)) + "px";
        // Auto-focus editor when expanding
        setTimeout(() => editor.focus(), 50);
      }
    });

    // Keyboard shortcuts
    editor.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          document.execCommand("bold");
          updateToolbarState();
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          document.execCommand("italic");
          updateToolbarState();
        }
      }
      // Escape to collapse widget
      if (e.key === "Escape") {
        widget.setAttribute("data-collapsed", "true");
        setPrefBool(PREF_COLLAPSED, true);
        widget.style.height = "";
      }
    });

    // Prevent image paste — allow text and rich text only
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
      // No images found — allow normal paste (rich text preserved)
    });

    // Save on input
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
    });

    // Close palette when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".zen-notes-color-dot") && !e.target.closest(".zen-notes-color-palette")) {
        colorPalette.setAttribute("data-visible", "false");
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) {
          setPrefInt(PREF_HEIGHT, h);
        }
      }
    });
    resizeObserver.observe(widget);

    widget._zenNotesCleanup = () => {
      resizeObserver.disconnect();
      sidebarObserver.disconnect();
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };

    // Initial toolbar state
    updateToolbarState();
  }

  function init() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      createWidget();
    } else {
      window.addEventListener("DOMContentLoaded", createWidget, { once: true });
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
