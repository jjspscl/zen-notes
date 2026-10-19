// ==UserScript==
// @name            Zen Notes UI
// @version         2.5.0-beta.8
// @description     Sidebar widget shell, storage lifecycle, and focus-scoped controls for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(() => {
  const N = window.ZenNotes;
  const {
    PREF_COLLAPSED,
    PREF_HEIGHT,
    PREF_PRESET,
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
    MAX_HEIGHT,
    DEFAULT_PRESET,
    cleanupDeprecatedPrefs,
    resolvePreset,
    schemeOf,
    getPrefBool,
    setPrefBool,
    getPrefString,
    getNumericPref,
    setNumericPref,
    clampHeight,
    SCROLL_BOTTOM_TOLERANCE,
    createXHTMLElement,
    createXULElement,
    nowISOString,
    formatDate,
  } = N;
  const DEBOUNCE_MS = 350;
  const AUTO_SAVE_MS = 5000;

  function createWidget() {
    cleanupDeprecatedPrefs();
    if (document.getElementById("zen-notes-widget")) return;
    const tabsToolbar = document.getElementById("TabsToolbar");
    const footButtons = document.getElementById("zen-sidebar-foot-buttons");
    if (!tabsToolbar || !footButtons) return;

    let state = null;
    let editorApi = null;
    let pendingSave = false;
    let saveTimer = null;
    let statusTimer = null;
    let destroyed = false;
    let resizeActive = false;
    let saveQueue = Promise.resolve();
    const widget = createXHTMLElement("div");
    widget.id = "zen-notes-widget";
    const collapsed = getPrefBool(PREF_COLLAPSED, false);
    widget.dataset.collapsed = String(collapsed);
    if (!collapsed) widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;

    const header = createXULElement("hbox");
    header.className = "zen-notes-header";
    header.setAttribute("align", "center");
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", String(!collapsed));
    header.setAttribute("aria-label", "Zen Notes. Click to collapse or expand.");
    const title = createXHTMLElement("span");
    title.className = "zen-notes-title-label";
    title.textContent = "Zen Notes";
    const headerActions = createXULElement("hbox");
    headerActions.className = "zen-notes-header-actions";
    const statusDot = createXHTMLElement("span");
    statusDot.className = "zen-notes-status-dot";
    statusDot.setAttribute("aria-hidden", "true");
    const chevron = createXHTMLElement("span");
    chevron.className = "zen-notes-toggle";
    chevron.setAttribute("aria-hidden", "true");
    headerActions.appendChild(statusDot);
    headerActions.appendChild(chevron);
    header.appendChild(title);
    header.appendChild(headerActions);

    const body = createXHTMLElement("div");
    body.className = "zen-notes-body";
    const toolbar = createXHTMLElement("div");
    toolbar.className = "zen-notes-toolbar";
    function button(icon, label, action) {
      const btn = createXHTMLElement("button");
      btn.type = "button";
      btn.className = `zen-notes-toolbar-btn${action === "more" ? " zen-notes-toolbar-more" : ""}`;
      btn.title = label;
      btn.setAttribute("aria-label", label);
      btn.dataset.action = action;
      const glyph = createXHTMLElement("span");
      glyph.className = "zen-notes-tb-icon";
      glyph.dataset.icon = icon;
      btn.appendChild(glyph);
      btn.addEventListener("mousedown", (event) => event.preventDefault());
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        handleToolbarAction(action);
      });
      return btn;
    }
    const toolbarButtons = [
      button("bold", "Bold (Ctrl+B)", "bold"),
      button("italic", "Italic (Ctrl+I)", "italic"),
      button("underline", "Underline (Ctrl+U)", "underline"),
      button("strikethrough", "Strikethrough (Ctrl+Shift+X)", "strike"),
      button("bullet", "Bulleted list (Ctrl+Shift+L)", "bullet"),
      button("numbered", "Numbered list (Ctrl+Shift+O)", "numbered"),
      button("checklist", "To-do list (Ctrl+Shift+C)", "todo"),
      button("link", "Insert link (Ctrl+K)", "link"),
    ];
    toolbarButtons.forEach((btn, index) => {
      if (index === 4 || index === 7) {
        const divider = createXHTMLElement("span");
        divider.className = "zen-notes-tb-divider";
        toolbar.appendChild(divider);
      }
      toolbar.appendChild(btn);
    });
    const moreButton = button("more", "More formatting", "more");
    moreButton.hidden = true;
    moreButton.setAttribute("aria-expanded", "false");
    toolbar.appendChild(moreButton);
    // Keep the toolbar on one row: hide trailing controls behind "more" instead of wrapping.
    function layoutToolbar() {
      const items = [...toolbar.children].filter((item) => item !== moreButton);
      items.forEach((item) => {
        item.hidden = false;
      });
      moreButton.hidden = true;
      if (toolbar.dataset.expanded === "true" || !toolbar.clientWidth) {
        moreButton.hidden = toolbar.dataset.expanded !== "true";
        return;
      }
      if (toolbar.scrollWidth <= toolbar.clientWidth) return;
      moreButton.hidden = false;
      for (let i = items.length - 1; i >= 0 && toolbar.scrollWidth > toolbar.clientWidth; i--) items[i].hidden = true;
      for (
        let i = items.length - 1;
        i >= 0 && (items[i].hidden || items[i].classList.contains("zen-notes-tb-divider"));
        i--
      )
        items[i].hidden = true;
    }
    function toggleToolbarOverflow() {
      const next = toolbar.dataset.expanded !== "true";
      toolbar.dataset.expanded = String(next);
      moreButton.setAttribute("aria-expanded", String(next));
      layoutToolbar();
    }

    const editor = createXHTMLElement("div");
    editor.className = "zen-notes-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", "Notes editor");
    function onEditorScroll() {
      const atBottom = editor.scrollTop + editor.clientHeight >= editor.scrollHeight - SCROLL_BOTTOM_TOLERANCE;
      editor.setAttribute("data-scroll-bottom", String(atBottom));
    }
    editor.addEventListener("scroll", onEditorScroll);
    const footerRow = createXHTMLElement("div");
    footerRow.className = "zen-notes-footer-row";
    const meta = createXHTMLElement("span");
    meta.className = "zen-notes-meta";
    const status = createXHTMLElement("span");
    status.className = "zen-notes-save-status";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    footerRow.appendChild(meta);
    footerRow.appendChild(status);
    body.appendChild(toolbar);
    body.appendChild(editor);
    body.appendChild(footerRow);
    const dragBar = createXHTMLElement("div");
    dragBar.className = "zen-notes-drag-bar";
    dragBar.setAttribute("aria-hidden", "true");
    dragBar.title = "Drag to resize";
    widget.appendChild(dragBar);
    widget.appendChild(header);
    widget.appendChild(body);
    tabsToolbar.insertBefore(widget, footButtons);

    function setStatus(message, kind = "saved", persistent = false) {
      status.textContent = message;
      status.dataset.state = message ? kind : "idle";
      statusDot.dataset.state = status.dataset.state;
      header.title = message || "";
      if (statusTimer) clearTimeout(statusTimer);
      if (message && !persistent)
        statusTimer = setTimeout(() => {
          status.textContent = "";
          status.dataset.state = "idle";
          statusDot.dataset.state = "idle";
          header.title = "";
        }, 1700);
    }
    function applyPreset() {
      const preset = resolvePreset(getPrefString(PREF_PRESET, DEFAULT_PRESET));
      widget.setAttribute("data-preset", preset);
      widget.setAttribute("data-scheme", schemeOf(preset));
    }
    function updateFooter() {
      const text = state?.note?.blocks?.map((block) => N.getPlainText(block)).join("\n") || "";
      meta.textContent = N.formatFooterMeta(state?.note?.updatedAt ? formatDate(state.note.updatedAt) : "", text);
    }
    function scheduleSave() {
      if (!state || state.readOnly || destroyed) return;
      pendingSave = true;
      setStatus("Saving…", "saving", true);
      updateFooter();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => flushSave(), DEBOUNCE_MS);
    }
    function flushSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (!pendingSave || !state || state.readOnly) return saveQueue;
      pendingSave = false;
      const snapshot = JSON.parse(JSON.stringify(state));
      saveQueue = saveQueue
        .then(() => N.storeSave(snapshot))
        .then((result) => {
          if (!destroyed) {
            state.revision = snapshot.revision;
            if (!pendingSave) {
              state.savedAt = snapshot.savedAt;
              state.note.updatedAt = snapshot.note.updatedAt;
            }
            if (pendingSave) setStatus("Saving…", "saving", true);
            else if (result?.mirrored === false) setStatus("Saved · rollback unavailable", "warning");
            else setStatus("Saved");
            updateFooter();
          }
        })
        .catch((error) => {
          pendingSave = true;
          if (!destroyed) {
            setStatus("Save failed", "error", true);
            status.title = String(error?.message || error);
            if (/changed in another window/i.test(String(error?.message || error))) {
              N.storeBackup(`conflict-${Date.now()}`, snapshot)
                .then(() => {
                  if (!destroyed) setStatus("Conflict copy backed up", "warning", true);
                })
                .catch((backupError) => console.error("[ZenNotes] Could not preserve conflict copy:", backupError));
            }
          }
          console.error("[ZenNotes] Save failed; current edits remain in memory:", error);
        });
      return saveQueue;
    }
    function handleToolbarAction(action) {
      if (action === "more") {
        toggleToolbarOverflow();
        return;
      }
      if (!editorApi || state?.readOnly) return;
      if (action === "bold" || action === "italic" || action === "underline" || action === "strike")
        editorApi.format({ bold: "b", italic: "i", underline: "u", strike: "s" }[action]);
      else if (action === "link") editorApi.link();
      else editorApi.setType(action);
      editor.focus();
    }
    function focusHeader() {
      header.focus();
    }
    function onWidgetKeydown(event) {
      if (!widget.contains(document.activeElement)) return;
      if (event.key === "Escape" && !event.defaultPrevented && editor.contains(document.activeElement)) {
        event.preventDefault();
        editor.blur();
        focusHeader();
      }
      // Editing shortcuts are handled by the editor's own keydown listener.
      // Never listen on document: address-bar and page shortcuts must remain untouched.
    }
    function toggleCollapsed() {
      const next = widget.dataset.collapsed !== "true";
      widget.dataset.collapsed = String(next);
      header.setAttribute("aria-expanded", String(!next));
      setPrefBool(PREF_COLLAPSED, next);
      if (next) widget.style.height = "";
      else {
        widget.style.height = `${clampHeight(getNumericPref(PREF_HEIGHT, DEFAULT_HEIGHT))}px`;
        setTimeout(() => editor.focus(), 50);
      }
    }
    header.addEventListener("click", (event) => {
      if (!event.target.closest("button")) toggleCollapsed();
    });
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCollapsed();
      }
    });
    widget.addEventListener("keydown", onWidgetKeydown);

    let dragOrigin = 0,
      dragHeight = 0;
    function onMouseMove(event) {
      if (resizeActive) widget.style.height = `${clampHeight(dragHeight + dragOrigin - event.clientY)}px`;
    }
    function onMouseUp() {
      if (!resizeActive) return;
      resizeActive = false;
      dragBar.classList.remove("zen-notes-drag-bar--active");
      setNumericPref(PREF_HEIGHT, clampHeight(Math.round(widget.getBoundingClientRect().height)));
    }
    dragBar.addEventListener("mousedown", (event) => {
      if (widget.dataset.collapsed === "true") return;
      resizeActive = true;
      dragOrigin = event.clientY;
      dragHeight = widget.getBoundingClientRect().height;
      dragBar.classList.add("zen-notes-drag-bar--active");
      event.preventDefault();
    });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver((entries) => {
            if (resizeActive) return;
            for (const entry of entries) {
              const value = Math.round(entry.contentRect.height);
              if (value >= MIN_HEIGHT && value <= MAX_HEIGHT) setNumericPref(PREF_HEIGHT, value);
            }
          })
        : null;
    resizeObserver?.observe(widget);
    const toolbarObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => layoutToolbar()) : null;
    toolbarObserver?.observe(toolbar);

    const prefObserver = {
      observe(_subject, topic, data) {
        if (topic !== "nsPref:changed") return;
        if (data === PREF_PRESET) applyPreset();
      },
    };
    try {
      Services.prefs.addObserver(PREF_PRESET, prefObserver);
    } catch (_) {}
    applyPreset();

    const unsubscribe = N.storeSubscribe(async () => {
      if (pendingSave) {
        setStatus("Changed elsewhere", "error", true);
        return;
      }
      try {
        const latest = await N.storeLoad();
        if (destroyed || latest.readOnly) return;
        state = latest;
        editorApi?.setBlocks(state.note.blocks);
        updateFooter();
        setStatus("Updated", "saved");
      } catch (error) {
        console.error("[ZenNotes] Could not reload update from another window:", error);
      }
    });

    N.storeLoad()
      .then((loaded) => {
        if (destroyed) return;
        state = loaded;
        editorApi = N.createBlockEditor(editor, state.note.blocks, {
          onChange(blocks) {
            if (!state || state.note.blocks === blocks) return;
            state.note.blocks = blocks;
            state.note.updatedAt = nowISOString();
            scheduleSave();
          },
        });
        if (state.readOnly) {
          editor.setAttribute("contenteditable", "false");
          setStatus("Read-only: newer version", "error", true);
          widget.dataset.readOnly = "true";
        }
        updateFooter();
      })
      .catch((error) => {
        console.error("[ZenNotes] Could not load note:", error);
        setStatus("Load failed", "error", true);
      });

    const autoSave = setInterval(() => {
      if (pendingSave) flushSave();
    }, AUTO_SAVE_MS);
    function cleanup() {
      if (destroyed) return;
      destroyed = true;
      if (pendingSave) flushSave();
      editorApi?.cleanup();
      resizeObserver?.disconnect();
      toolbarObserver?.disconnect();
      unsubscribe();
      clearInterval(autoSave);
      editor.removeEventListener("scroll", onEditorScroll);
      if (saveTimer) clearTimeout(saveTimer);
      if (statusTimer) clearTimeout(statusTimer);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        Services.prefs.removeObserver(PREF_PRESET, prefObserver);
      } catch (_) {}
      widget.remove();
    }
    widget._zenNotesCleanup = cleanup;
  }

  function init(tries = 0) {
    try {
      createWidget();
    } catch (error) {
      console.error("[ZenNotes] Widget init failed:", error);
    }
    if (!document.getElementById("zen-notes-widget") && tries < 5) setTimeout(() => init(tries + 1), 250 * (tries + 1));
  }
  function cleanup() {
    document.getElementById("zen-notes-widget")?._zenNotesCleanup?.();
  }
  if (typeof window.addUnloadListener === "function") window.addUnloadListener(cleanup);
  window.addEventListener("unload", cleanup, { once: true });
  /** Builds the widget when the browser is idle so it never delays first paint or tab restore. */
  const IDLE_TIMEOUT_MS = 1500;
  function initWhenIdle() {
    if (typeof window.requestIdleCallback === "function")
      window.requestIdleCallback(() => init(), { timeout: IDLE_TIMEOUT_MS });
    else init();
  }
  if (document.readyState === "complete" || document.readyState === "interactive") initWhenIdle();
  else window.addEventListener("DOMContentLoaded", initWhenIdle, { once: true });
})();
