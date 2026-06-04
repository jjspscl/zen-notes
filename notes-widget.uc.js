// ==UserScript==
// @name            Zen Notes Widget
// @version         0.1.1-alpha
// @description     Persistent notes widget in Zen Browser sidebar
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  const PREF_CONTENT = "zen.notes.content";
  const PREF_COLLAPSED = "zen.notes.collapsed";
  const PREF_HEIGHT = "zen.notes.height";

  const DEFAULT_HEIGHT = 200;
  const MIN_HEIGHT = 100;
  const MAX_HEIGHT = 400;

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
      console.error("ZenNotes: failed to save pref", key, e);
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
      console.error("ZenNotes: failed to save pref", key, e);
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
      console.error("ZenNotes: failed to save pref", key, e);
    }
  }

  let saveTimeout = null;

  function debouncedSave(value) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      setPrefString(PREF_CONTENT, value);
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

    const widget = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "vbox");
    widget.id = "zen-notes-widget";
    widget.setAttribute("flex", "0");
    widget.setAttribute("data-collapsed", isCollapsed ? "true" : "false");
    if (!isCollapsed) {
      widget.style.height = clampedHeight + "px";
    }

    const header = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "hbox");
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");

    const title = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    title.className = "zen-notes-title";
    title.textContent = "Notes";

    const toggle = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    toggle.className = "zen-notes-toggle";

    header.appendChild(title);
    header.appendChild(toggle);

    const body = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "vbox");
    body.className = "zen-notes-body";
    body.setAttribute("flex", "1");

    const editor = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    editor.className = "zen-notes-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.textContent = savedContent;

    body.appendChild(editor);
    widget.appendChild(header);
    widget.appendChild(body);

    tabsToolbar.insertBefore(widget, footButtons);

    header.addEventListener("click", (e) => {
      if (e.target.closest(".zen-notes-editor")) return;

      const currentlyCollapsed = widget.getAttribute("data-collapsed") === "true";
      const newCollapsed = !currentlyCollapsed;
      widget.setAttribute("data-collapsed", newCollapsed ? "true" : "false");
      setPrefBool(PREF_COLLAPSED, newCollapsed);

      if (newCollapsed) {
        widget.style.height = "";
      } else {
        const h = getPrefInt(PREF_HEIGHT, DEFAULT_HEIGHT);
        widget.style.height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)) + "px";
      }
    });

    editor.addEventListener("input", () => {
      debouncedSave(editor.textContent || "");
    });

    editor.addEventListener("blur", () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      setPrefString(PREF_CONTENT, editor.textContent || "");
    });

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
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
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
