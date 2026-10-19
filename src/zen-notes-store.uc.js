// ==UserScript==
// @name            Zen Notes Store
// @version         2.5.0
// @description     Atomic file storage, migration, and window synchronization for Zen Notes
// @author          jjspscl
// @include         main
// @run-at          document-end
// ==/UserScript==

(() => {
  const {
    SCHEMA_VERSION,
    PREF_DATA,
    PREF_DATA_BACKUP,
    createId,
    createNote,
    nowISOString,
    getPrefString,
    blocksToHTML,
    htmlToBlocks,
  } = window.ZenNotes;
  // v4 (2.4.x) rollback mirror fields that no longer have any behaviour in v5.
  const V4_WORKSPACE_ID = "global-default";
  const V4_COLOR = "yellow";
  const TOPIC = "zen-notes-data-changed";
  const PREF_FILE_FALLBACK = "zen.notes.dataV5Fallback";
  const BACKUP_COUNT = 5;
  let revision = Date.now();
  const lockOwner = createId("writer");
  const subscribers = new Set();
  let paths = null;

  function getPaths() {
    if (!globalThis.PathUtils?.profileDir || !globalThis.PathUtils?.join) return null;
    if (!paths) {
      const dir = PathUtils.join(PathUtils.profileDir, "zen-notes");
      paths = {
        dir,
        data: PathUtils.join(dir, "notes.json"),
        temp: PathUtils.join(dir, "notes.tmp.json"),
        legacy: PathUtils.join(dir, "notes.legacy-v4.json"),
      };
    }
    return paths;
  }
  async function ensureDirectory(pathSet) {
    await IOUtils.makeDirectory(pathSet.dir, { createAncestors: true, ignoreExisting: true });
  }
  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
  async function withFileLock(pathSet, operation) {
    const lockPath = PathUtils.join(pathSet.dir, "notes.lock");
    const deadline = Date.now() + 5000;
    let acquired = false;
    while (!acquired && Date.now() < deadline) {
      try {
        await IOUtils.writeUTF8(lockPath, JSON.stringify({ owner: lockOwner, createdAt: Date.now() }), {
          mode: "create",
          flush: true,
        });
        acquired = true;
      } catch (_error) {
        try {
          const lock = JSON.parse(await IOUtils.readUTF8(lockPath));
          if (!Number.isFinite(lock.createdAt) || Date.now() - lock.createdAt > 15000) await IOUtils.remove(lockPath);
        } catch (_) {}
        if (!acquired) await sleep(35);
      }
    }
    if (!acquired) throw new Error("Could not acquire the note storage lock; retry your save.");
    try {
      return await operation();
    } finally {
      try {
        const lock = JSON.parse(await IOUtils.readUTF8(lockPath));
        if (lock.owner === lockOwner) await IOUtils.remove(lockPath);
      } catch (_) {}
    }
  }
  async function backupCurrent(pathSet) {
    try {
      if (!(await IOUtils.exists(pathSet.data))) return;
      const old = await IOUtils.readJSON(pathSet.data);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await IOUtils.writeJSON(PathUtils.join(pathSet.dir, `notes.backup-${timestamp}.json`), old, {
        tmpPath: PathUtils.join(pathSet.dir, `backup-${timestamp}.tmp`),
      });
      const entries = await IOUtils.getChildren(pathSet.dir);
      const backups = entries.filter((path) => /notes\.backup-.*\.json$/.test(path)).sort();
      while (backups.length > BACKUP_COUNT) await IOUtils.remove(backups.shift());
    } catch (error) {
      console.warn("[ZenNotes] Could not make rolling backup:", error);
    }
  }
  function getPrefBackup() {
    try {
      Services.prefs.setStringPref(PREF_DATA_BACKUP, getPrefString(PREF_DATA, ""));
    } catch (error) {
      console.warn("[ZenNotes] Could not back up legacy preference:", error);
    }
  }
  function makeInitialState(workspaceId = V4_WORKSPACE_ID) {
    const note = createNote("Zen Notes");
    return {
      schemaVersion: SCHEMA_VERSION,
      note: { ...note, contentHTML: undefined, blocks: [window.ZenNotes.createBlock("paragraph")] },
      lastWorkspaceId: workspaceId || V4_WORKSPACE_ID,
      savedAt: nowISOString(),
      revision,
    };
  }
  function migratePref() {
    const raw = getPrefString(PREF_DATA, "");
    if (!raw) {
      const initial = makeInitialState();
      const legacyContent = getPrefString("zen.notes.content", "");
      if (legacyContent) initial.note.blocks = htmlToBlocks(legacyContent);
      return initial;
    }
    try {
      const old = JSON.parse(raw);
      const oldVersion = Number(old.schemaVersion || old.version) || 0;
      if (oldVersion > SCHEMA_VERSION) return { ...old, readOnly: true, readOnlyReason: "newer-schema" };
      const oldNote = old.note && typeof old.note === "object" ? old.note : null;
      const legacyContent = oldNote?.contentHTML || old.contentHTML || getPrefString("zen.notes.content", "");
      const note = {
        id: oldNote?.id || createId("note"),
        title: oldNote?.title || "Zen Notes",
        createdAt: oldNote?.createdAt || nowISOString(),
        updatedAt: oldNote?.updatedAt || nowISOString(),
        blocks: htmlToBlocks(legacyContent || ""),
      };
      return {
        schemaVersion: SCHEMA_VERSION,
        note,
        lastWorkspaceId: old.lastWorkspaceId || V4_WORKSPACE_ID,
        savedAt: nowISOString(),
        revision,
      };
    } catch (error) {
      getPrefBackup();
      console.warn(
        "[ZenNotes] Legacy note data was invalid; preserving backup and starting with an empty note.",
        error,
      );
      return makeInitialState();
    }
  }
  function mirrorToPref(state) {
    const oldStyleState = {
      version: 4,
      lastWorkspaceId: state.lastWorkspaceId || V4_WORKSPACE_ID,
      note: {
        id: state.note.id,
        title: state.note.title || "Zen Notes",
        contentHTML: blocksToHTML(state.note.blocks || []),
        color: V4_COLOR,
        createdAt: state.note.createdAt,
        updatedAt: state.note.updatedAt || nowISOString(),
        legacyLastEditedLabel: "",
        order: 0,
      },
    };
    try {
      Services.prefs.setStringPref(PREF_DATA, JSON.stringify(oldStyleState));
      Services.prefs.setIntPref("zen.notes.schemaVersion", 4);
      return true;
    } catch (error) {
      console.error("[ZenNotes] Note file saved but compatibility preference mirror failed:", error);
      return false;
    }
  }
  function notify(rev) {
    revision = Math.max(revision + 1, Number(rev) || 0);
    try {
      Services.obs.notifyObservers(null, TOPIC, String(revision));
    } catch (error) {
      console.warn("[ZenNotes] Could not notify other windows:", error);
    }
  }
  async function storeLoad() {
    const pathSet = getPaths();
    if (pathSet && globalThis.IOUtils?.readJSON) {
      try {
        if (await IOUtils.exists(pathSet.data)) {
          const state = await IOUtils.readJSON(pathSet.data);
          if (state && Number(state.schemaVersion) > SCHEMA_VERSION) {
            return { ...state, readOnly: true, readOnlyReason: "newer-schema" };
          }
          if (state?.schemaVersion === SCHEMA_VERSION && state.note && Array.isArray(state.note.blocks)) {
            revision = Math.max(revision, Number(state.revision) || 0);
            return state;
          }
          getPrefBackup();
          console.warn("[ZenNotes] Note file has an unsupported schema; trying preference recovery.");
        }
      } catch (error) {
        console.error("[ZenNotes] Could not read note file; trying preference recovery:", error);
        getPrefBackup();
      }
    } else {
      console.warn("[ZenNotes] IOUtils/PathUtils unavailable; using preference-backed storage.");
    }

    let fallbackState = null;
    const fallback = getPrefString(PREF_FILE_FALLBACK, "");
    if (fallback) {
      try {
        fallbackState = JSON.parse(fallback);
        if (Number(fallbackState.schemaVersion) > SCHEMA_VERSION)
          return { ...fallbackState, readOnly: true, readOnlyReason: "newer-schema" };
        if (
          !(
            fallbackState.schemaVersion === SCHEMA_VERSION &&
            fallbackState.note &&
            Array.isArray(fallbackState.note.blocks)
          )
        )
          fallbackState = null;
      } catch (error) {
        try {
          Services.prefs.setStringPref(PREF_DATA_BACKUP, fallback);
        } catch (_) {}
        console.warn("[ZenNotes] Could not parse preference-backed v5 state:", error);
        fallbackState = null;
      }
    }

    const raw = getPrefString(PREF_DATA, "");
    if (raw) getPrefBackup();
    let loaded = fallbackState || migratePref();
    let didMigrate = !fallbackState;
    if (loaded.readOnly) return loaded;
    if (pathSet && globalThis.IOUtils?.writeJSON) {
      try {
        await ensureDirectory(pathSet);
        await withFileLock(pathSet, async () => {
          let usable = false;
          if (await IOUtils.exists(pathSet.data)) {
            try {
              const concurrent = await IOUtils.readJSON(pathSet.data);
              if (Number(concurrent.schemaVersion) > SCHEMA_VERSION) {
                loaded = { ...concurrent, readOnly: true, readOnlyReason: "newer-schema" };
                didMigrate = false;
                usable = true;
              } else if (concurrent.schemaVersion === SCHEMA_VERSION && Array.isArray(concurrent.note?.blocks)) {
                loaded = concurrent;
                didMigrate = false;
                usable = true;
              }
            } catch (error) {
              console.warn("[ZenNotes] Existing note file is corrupt; preserving it before recovery:", error);
            }
            if (!usable) {
              try {
                await IOUtils.writeUTF8(
                  PathUtils.join(pathSet.dir, `notes.corrupt-${Date.now()}.json`),
                  await IOUtils.readUTF8(pathSet.data),
                );
              } catch (_) {}
              await IOUtils.remove(pathSet.data);
            }
          }
          if (!usable) {
            if (raw)
              await IOUtils.writeUTF8(pathSet.legacy, raw, { tmpPath: PathUtils.join(pathSet.dir, "legacy.tmp") });
            await IOUtils.writeJSON(pathSet.data, loaded, {
              tmpPath: pathSet.temp,
              backupFile: PathUtils.join(pathSet.dir, "notes.previous.json"),
            });
          }
        });
      } catch (error) {
        console.error("[ZenNotes] Initial note migration could not write file:", error);
      }
    }
    if (loaded.readOnly) return loaded;
    revision = Math.max(revision, Number(loaded.revision) || 0);
    mirrorToPref(loaded);
    if (didMigrate) console.info(`[ZenNotes] migrated legacy note: ${loaded.note.blocks.length} blocks`);
    return loaded;
  }
  async function storeSave(state) {
    if (!state?.note || !Array.isArray(state.note.blocks)) throw new TypeError("Invalid Zen Notes state");
    if (state.readOnly) throw new Error("This note was created by a newer Zen Notes version and is read-only.");
    const next = { ...state, schemaVersion: SCHEMA_VERSION, savedAt: nowISOString() };
    next.note = { ...next.note, updatedAt: nowISOString() };
    const pathSet = getPaths();
    if (pathSet && globalThis.IOUtils?.writeJSON) {
      await ensureDirectory(pathSet);
      await withFileLock(pathSet, async () => {
        let diskRevision = 0;
        if (await IOUtils.exists(pathSet.data)) {
          const current = await IOUtils.readJSON(pathSet.data);
          diskRevision = Number(current.revision) || 0;
          if (diskRevision > (Number(state.revision) || 0))
            throw new Error("Note changed in another window. Copy your pending text before reloading.");
          await backupCurrent(pathSet);
        }
        next.revision = Math.max(revision, diskRevision) + 1;
        await IOUtils.writeJSON(pathSet.data, next, {
          tmpPath: pathSet.temp,
          backupFile: PathUtils.join(pathSet.dir, "notes.previous.json"),
        });
      });
    } else {
      next.revision = revision + 1;
      try {
        Services.prefs.setStringPref(PREF_FILE_FALLBACK, JSON.stringify(next));
      } catch (error) {
        throw new Error(
          `IOUtils is unavailable and the preference fallback could not save this note: ${error.message || error}`,
        );
      }
    }
    const mirrored = mirrorToPref(next);
    Object.assign(state, next);
    notify(next.revision);
    return { mirrored };
  }
  async function storeBackup(label, state) {
    const pathSet = getPaths();
    if (!pathSet || !globalThis.IOUtils?.writeJSON) return false;
    await ensureDirectory(pathSet);
    const safeLabel = String(label || "manual")
      .replace(/[^a-z0-9_-]/gi, "-")
      .slice(0, 40);
    await IOUtils.writeJSON(PathUtils.join(pathSet.dir, `notes.${safeLabel}.json`), state, {
      tmpPath: PathUtils.join(pathSet.dir, `backup-${safeLabel}.tmp`),
    });
    const backups = (await IOUtils.getChildren(pathSet.dir))
      .filter((path) => /notes\.(?:conflict|manual)-.*\.json$/.test(path))
      .sort();
    while (backups.length > BACKUP_COUNT) await IOUtils.remove(backups.shift());
    return true;
  }
  async function storeExists() {
    const pathSet = getPaths();
    return !!(pathSet && globalThis.IOUtils?.exists && (await IOUtils.exists(pathSet.data)));
  }
  function storeSubscribe(callback) {
    subscribers.add(callback);
    const observer = {
      observe(_subject, _topic, data) {
        const incoming = Number(data) || 0;
        if (incoming <= revision) return;
        revision = incoming;
        callback(incoming);
      },
    };
    try {
      Services.obs.addObserver(observer, TOPIC);
    } catch (_error) {}
    const unsubscribe = () => {
      subscribers.delete(callback);
      try {
        Services.obs.removeObserver(observer, TOPIC);
      } catch (_error) {}
    };
    return unsubscribe;
  }

  Object.assign(window.ZenNotes, {
    STORE_TOPIC: TOPIC,
    storeLoad,
    storeSave,
    storeBackup,
    storeExists,
    storeSubscribe,
    storeRevision: () => revision,
  });
})();
