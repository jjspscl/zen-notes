const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

test("local harness server serves XHTML and live reload client", async () => {
  const port = 42000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["scripts/launch-zen.js", "--server-only"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, ZEN_NOTES_PORT: String(port) },
    stdio: "ignore",
  });
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { response = await fetch(`http://127.0.0.1:${port}/dev/harness.xhtml`); break; }
      catch (_) { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    assert.ok(response, "server should become available");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/xhtml\+xml/);
    assert.match(await response.text(), /createBlockEditor|Zen Notes local editor harness/);
    const reload = await fetch(`http://127.0.0.1:${port}/__reload.js`);
    assert.match(await reload.text(), /EventSource/);
    const traversal = await fetch(`http://127.0.0.1:${port}/..%2f..%2fAGENTS.md`);
    assert.equal(traversal.status, 404);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
});

test("WSL launcher uses PowerShell Start-Process to preserve Windows paths with spaces", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(path.resolve(__dirname, "../scripts/launch-zen.js"), "utf8");
  assert.match(source, /Start-Process -FilePath/);
  assert.match(source, /spawn\("powershell\.exe"/);
  assert.doesNotMatch(source, /start "" "\$\{winZen\}"/);
});
