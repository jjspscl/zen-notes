#!/usr/bin/env node

/**
 * validate.js — release-contract checks that no generic linter covers:
 * version sync, Sine theme.json shape, UserScript headers, CSS block balance.
 */

const { read, readBytes, readJson, exists, scriptFiles, scriptMap } = require("./lib/manifest");

const REPO_URL = "https://github.com/jjspscl/zen-notes";
const HEADER_FIELDS = ["name", "version", "description", "author", "include", "run-at"];
const errors = [];
const fail = (message) => errors.push(message);

function checkTheme(theme) {
  for (const field of [
    "id",
    "name",
    "description",
    "author",
    "version",
    "homepage",
    "readme",
    "fork",
    "style",
    "scripts",
    "preferences",
  ]) {
    if (!(field in theme)) fail(`theme.json: missing field "${field}"`);
  }
  if (typeof theme.style?.chrome !== "string") fail("theme.json: style.chrome is required");
  for (const [file, meta] of Object.entries(scriptMap(theme.scripts))) {
    if (!meta.include?.length) fail(`theme.json: script "${file}" needs a non-empty include list`);
    if (!exists(file)) fail(`theme.json: script "${file}" not found on disk`);
  }
  checkStoreListing(theme);
  for (const file of [theme.style?.chrome, theme.preferences, "README.md"]) {
    if (file && !exists(file)) fail(`theme.json references missing file: ${file}`);
  }
}

/** The Sine store shows `image` (16:9, loaded from main) and a short description. */
function checkStoreListing(theme) {
  const IMAGE_PREFIX = `${REPO_URL.replace("github.com", "raw.githubusercontent.com")}/main/`;
  if (!theme.image?.startsWith(IMAGE_PREFIX)) fail(`theme.json image must be a raw URL under ${IMAGE_PREFIX}`);
  else {
    const file = theme.image.slice(IMAGE_PREFIX.length);
    if (!exists(file)) fail(`theme.json image file not found: ${file}`);
    else {
      const bytes = readBytes(file);
      if (bytes.length > 600 * 1024)
        fail(`${file} is ${(bytes.length / 1024).toFixed(0)} KB; keep store images under 600 KB`);
      if (file.endsWith(".png")) {
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        if (Math.abs(width / height - 16 / 9) > 0.01) fail(`${file} is ${width}x${height}; the store expects 16:9`);
      }
    }
  }
  if ((theme.description || "").length > 100) fail("theme.json description must be 100 characters or fewer");
  if (!exists("docs/assets/logo.svg")) fail("docs/assets/logo.svg is missing");
  else if (!/viewBox=/.test(read("docs/assets/logo.svg"))) fail("docs/assets/logo.svg needs a viewBox");
}

function checkVersions(theme) {
  const versions = {
    "theme.json": theme.version,
    "mod.json": readJson("mod.json").version,
    "package.json": readJson("package.json").version,
  };
  versions["README badge"] = read("README.md")
    .match(/version-([\dA-Za-z.]+(?:--[0-9A-Za-z.-]+)?)-blue/)?.[1]
    ?.replace(/--/g, "-");
  versions["ROADMAP header"] = read("ROADMAP.md").match(/\*\*v([\dA-Za-z.-]+)\*\*/)?.[1];
  for (const file of scriptFiles()) {
    versions[`${file} @version`] = read(file)
      .match(/\/\/\s*@version\s+(.+)/)?.[1]
      ?.trim();
    const runtime = read(file).match(/const VERSION = "([^"]+)";/)?.[1];
    if (runtime) versions[`${file} VERSION`] = runtime;
  }
  const styleFile = theme.style?.chrome;
  if (styleFile && exists(styleFile))
    versions[`${styleFile} header`] = read(styleFile).match(/Zen Notes Widget — v(\S+)/)?.[1];
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1)
    fail(
      `version mismatch:\n${Object.entries(versions)
        .map(([k, v]) => `    ${k.padEnd(40)} ${v}`)
        .join("\n")}`,
    );

  const expectedHome = theme.version.includes("-") ? `${REPO_URL}/tree/beta` : REPO_URL;
  if (theme.homepage !== expectedHome) fail(`theme.json homepage is ${theme.homepage}; expected ${expectedHome}`);
  if (Number.isNaN(Date.parse(theme.updatedAt)))
    fail("theme.json updatedAt must be an ISO timestamp (Sine only updates when it is newer)");
}

function checkHeaders() {
  for (const file of scriptFiles().filter((f) => f.endsWith(".uc.js"))) {
    const block = read(file).match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!block) {
      fail(`${file}: UserScript header not found`);
      continue;
    }
    const fields = Object.fromEntries(
      [...block[1].matchAll(/^\s*\/\/\s*@([\w-]+)\s+(.+)/gm)].map((m) => [m[1], m[2].trim()]),
    );
    const missing = HEADER_FIELDS.filter((f) => !fields[f]);
    if (missing.length) fail(`${file}: missing header fields ${missing.join(", ")}`);
  }
}

function checkCss(file) {
  const css = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  let depth = 0;
  for (const char of css) {
    if (char === "{") depth++;
    if (char === "}" && --depth < 0) break;
  }
  if (depth !== 0) fail(`${file}: unbalanced braces`);
}

const theme = readJson("theme.json");
checkTheme(theme);
checkVersions(theme);
checkHeaders();
if (theme.style?.chrome && exists(theme.style.chrome)) checkCss(theme.style.chrome);

if (errors.length) {
  console.error(`❌ validate failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
console.log(`✅ validate ok (${theme.id} @ ${theme.version}, ${scriptFiles().length} scripts)`);
