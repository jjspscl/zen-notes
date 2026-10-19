#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const { ROOT, scriptFiles } = require("./lib/manifest");
const PORT = Number(process.env.ZEN_NOTES_PORT || 41773);
const HARNESS_URL = `http://127.0.0.1:${PORT}/dev/harness.xhtml`;
const args = new Set(process.argv.slice(2));
const clients = new Set();
const SERVED_FILES = new Set(["dev/harness.xhtml", "src/style.css", ...scriptFiles()]);

function isWSL() {
  try {
    return (
      Boolean(process.env.WSL_DISTRO_NAME) ||
      fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")
    );
  } catch (_) {
    return false;
  }
}
function sendReload() {
  for (const client of clients) client.write("data: reload\n\n");
}
function mime(file) {
  return (
    {
      ".xhtml": "application/xhtml+xml; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
    }[path.extname(file)] || "application/octet-stream"
  );
}
function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = new globalThis.URL(request.url, HARNESS_URL).pathname;
    if (pathname === "/__events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write("data: connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    if (pathname === "/__reload.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(
        'new EventSource("/__events").onmessage = (event) => { if (event.data === "reload") location.reload(); };',
      );
      return;
    }
    const relative = pathname === "/" ? "dev/harness.xhtml" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const file = path.resolve(ROOT, relative);
    if (
      !SERVED_FILES.has(relative) ||
      !file.startsWith(ROOT + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime(file),
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(file).pipe(response);
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[ZenNotes] Harness serving at ${HARNESS_URL}`);
    console.log("[ZenNotes] Changes to source files reload the harness. Ctrl+C stops it.");
  });
  return server;
}
function watchSource() {
  for (const directory of [path.join(ROOT, "src"), path.join(ROOT, "dev"), path.join(ROOT, "scripts")]) {
    try {
      fs.watch(directory, (_event, filename) => {
        if (filename && !String(filename).includes("node_modules")) sendReload();
      });
    } catch (error) {
      console.warn(`[ZenNotes] Could not watch ${directory}: ${error.message}`);
    }
  }
}
function launchBrowser() {
  const wsl = isWSL();
  const winZen = process.env.ZEN_PATH || "C:\\Users\\jpascual\\AppData\\Local\\Zen Browser\\zen.exe";
  const winProfile = process.env.ZEN_PROFILE || "C:\\Users\\jpascual\\AppData\\Local\\Temp\\zen-notes-dev";
  const nativeZen = process.env.ZEN_PATH || (process.platform === "win32" ? winZen : "zen");
  if (wsl) {
    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    // Start-Process receives a single Windows command line. Keep quotes around
    // both paths because the default Zen and profile locations contain spaces.
    const argumentLine = `-no-remote -profile "${winProfile}" "${HARNESS_URL}"`;
    const command = `Start-Process -FilePath ${psQuote(winZen)} -ArgumentList ${psQuote(argumentLine)}`;
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.log(`[ZenNotes] Starting Windows Zen with a disposable profile: ${winProfile}`);
    return;
  }
  if (process.platform === "win32") {
    const child = spawn(nativeZen, ["-no-remote", "-profile", winProfile, HARNESS_URL], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return;
  }
  const profile = process.env.ZEN_PROFILE || path.join(os.tmpdir(), "zen-notes-dev");
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(nativeZen, ["-no-remote", "-profile", profile, HARNESS_URL], { detached: true, stdio: "ignore" });
  child.unref();
}
function openDefaultBrowser() {
  if (process.platform === "win32")
    spawn("cmd.exe", ["/c", "start", "", HARNESS_URL], { detached: true, stdio: "ignore" }).unref();
  else if (isWSL()) spawn("explorer.exe", [HARNESS_URL], { detached: true, stdio: "ignore" }).unref();
  else spawn(process.env.BROWSER || "xdg-open", [HARNESS_URL], { detached: true, stdio: "ignore" }).unref();
}

if (args.has("--test")) {
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "test/model.test.js",
      "test/conversion.test.js",
      "test/editor.test.js",
      "test/store.test.js",
      "test/launcher.test.js",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
const server = startServer();
watchSource();
if (!args.has("--server-only"))
  setTimeout(() => {
    if (args.has("--browser")) openDefaultBrowser();
    else launchBrowser();
  }, 250);
function shutdown() {
  server.close();
  for (const client of clients) client.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
