// ==UserScript==
// @name            Zen Notes Editor
// @version         2.4.2
// @description     Sanitizer, normalizer, and content-tree utilities for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  const {
    ALLOWED_TAGS, ALLOWED_HREF_SCHEMES, CHECKLIST_ATTR, MAX_LIST_DEPTH,
    createScratchElement, createXHTMLElement, getScratchDocument,
    stripLegacyNamespaceAttrs,
  } = window.ZenNotes;

  function sanitizeHTML(html) {
    const scratch = getScratchDocument();
    const source = createScratchElement("div");
    const target = createScratchElement("div");
    source.innerHTML = stripLegacyNamespaceAttrs(html);
    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return (scratch || document).createTextNode(node.textContent || "");
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      // localName is reliably lowercase in both HTML and XHTML documents;
      // tagName is not (see 2.3.3 regression), so derive the key from it.
      const tagName = node.localName.toUpperCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = (scratch || document).createDocumentFragment();
        for (const child of node.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) fragment.appendChild(safeChild); }
        return fragment;
      }
      const safeElement = createScratchElement(tagName.toLowerCase());
      if (tagName === "LI" && node.hasAttribute("data-checked")) safeElement.setAttribute("data-checked", node.getAttribute("data-checked"));
      if ((tagName === "UL" || tagName === "OL") && node.hasAttribute(CHECKLIST_ATTR)) safeElement.setAttribute(CHECKLIST_ATTR, node.getAttribute(CHECKLIST_ATTR));
      if (tagName === "A" && node.hasAttribute("href")) {
        try {
          const url = new URL(node.getAttribute("href"));
          // Store the parsed href, not the raw attribute. new URL() lowercases
          // the scheme and percent-encodes the rest, so "HTTP://x" cannot be
          // stored in a form that later case-sensitive checks would reject.
          if (ALLOWED_HREF_SCHEMES.includes(url.protocol)) safeElement.setAttribute("href", url.href);
        } catch (e) {}
      }
      for (const child of node.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) safeElement.appendChild(safeChild); }
      return safeElement;
    }
    for (const child of source.childNodes) { const safeChild = sanitizeNode(child); if (safeChild) target.appendChild(safeChild); }
    normalizeEditorTree(target);
    return target.innerHTML;
  }

  function isTag(node, name) {
    return !!node && node.nodeType === Node.ELEMENT_NODE && node.localName === name;
  }
  function isListTag(node) {
    return isTag(node, "ul") || isTag(node, "ol");
  }

  const _normalizeDigests = new WeakMap();
  function normalizeEditorTree(root) {
    if (!root || !root.querySelectorAll) return;
    const html = root.innerHTML;
    if (_normalizeDigests.get(root) === html) return;
    _normalizeDigests.set(root, html);
    const legacyLists = root.querySelectorAll("ul.zen-notes-checklist, ol.zen-notes-checklist");
    for (const list of legacyLists) {
      list.setAttribute(CHECKLIST_ATTR, "true");
      list.classList.remove("zen-notes-checklist");
    }
    let nested = root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol");
    while (nested.length > 0) {
      for (const n of nested) {
        const parent = n.parentElement;
        if (!parent) continue;
        const prevLi = n.previousElementSibling;
        if (isTag(prevLi, "li")) {
          prevLi.appendChild(n);
        } else {
          const children = Array.from(n.childNodes);
          for (const child of children) parent.insertBefore(child, n);
          parent.removeChild(n);
        }
      }
      nested = root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol");
    }
    const allLIs = root.querySelectorAll("li");
    for (const li of allLIs) {
      const parent = li.parentElement;
      if (isListTag(parent)) continue;
      const ownerDoc = li.ownerDocument || getScratchDocument() || document;
      const newUl = ownerDoc.createElement
        ? ownerDoc.createElement("ul")
        : createXHTMLElement("ul");
      if (parent) parent.insertBefore(newUl, li);
      newUl.appendChild(li);
      const prev = newUl.previousElementSibling;
      if (isTag(prev, "ul")) {
        while (newUl.firstChild) prev.appendChild(newUl.firstChild);
        if (newUl.parentNode) newUl.parentNode.removeChild(newUl);
      }
    }
    const soleBR = root.querySelectorAll("ul > li:only-child, ol > li:only-child");
    for (const li of soleBR) {
      if (li.childNodes.length === 1 && isTag(li.childNodes[0], "br")) {
        const list = li.parentElement;
        if (list) list.removeChild(li);
      }
    }
    const allLists = root.querySelectorAll("ul, ol");
    for (const list of allLists) {
      if (!list.querySelector(":scope > li")) {
        if (list.parentNode) list.parentNode.removeChild(list);
      }
    }
    const checkedLIs = root.querySelectorAll("li[data-checked]");
    for (const li of checkedLIs) {
      let list = li.parentElement;
      let inChecklist = false;
      while (list) {
        if (isListTag(list) && list.getAttribute(CHECKLIST_ATTR) === "true") {
          inChecklist = true;
          break;
        }
        list = list.parentElement;
      }
      if (!inChecklist) li.removeAttribute("data-checked");
    }
    const depthCandidates = root.querySelectorAll("ul, ol");
    for (const list of depthCandidates) {
      let depth = 0;
      let p = list.parentElement;
      while (p) {
        if (isListTag(p)) depth++;
        p = p.parentElement;
      }
      if (depth >= MAX_LIST_DEPTH) {
        const parent = list.parentElement;
        if (!parent) continue;
        const children = Array.from(list.childNodes);
        if (isTag(parent, "li") && parent.parentElement) {
          const ownerList = parent.parentElement;
          const anchor = parent.nextSibling;
          for (const child of children) {
            if (isTag(child, "li")) ownerList.insertBefore(child, anchor);
            else parent.appendChild(child);
          }
        } else {
          for (const child of children) parent.insertBefore(child, list);
        }
        if (list.parentNode) list.parentNode.removeChild(list);
      }
    }
  }

  window.ZenNotes.sanitizeHTML = sanitizeHTML;
  window.ZenNotes.isTag = isTag;
  window.ZenNotes.isListTag = isListTag;
  window.ZenNotes.normalizeEditorTree = normalizeEditorTree;
})();
