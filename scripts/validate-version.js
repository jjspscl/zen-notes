#!/usr/bin/env node
/**
 * validate-version.js — Ensures version strings are synchronized
 * across theme.json, mod.json, notes-widget.uc.js, README.md, and ROADMAP.md.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function extractJsonVersion(file) {
  return JSON.parse(read(file)).version;
}

function extractUserScriptHeaderVersion() {
  const match = read("notes-widget.uc.js").match(/\/\/\s*@version\s+(.+)/);
  return match ? match[1].trim() : null;
}

function extractRuntimeVersion() {
  const match = read("notes-widget.uc.js").match(/const VERSION = "([^"]+)";/);
  return match ? match[1] : null;
}

function extractReadmeVersion() {
  const match = read("README.md").match(/version-([\dA-Za-z.]+(?:--[0-9A-Za-z.-]+)?)-blue/);
  return match ? match[1].replace(/--/g, "-") : null;
}

function extractRoadmapVersion() {
  const match = read("ROADMAP.md").match(/\*\*v([\dA-Za-z.-]+)\*\*/);
  return match ? match[1] : null;
}

function main() {
  const versions = {
    "theme.json": extractJsonVersion("theme.json"),
    "mod.json": extractJsonVersion("mod.json"),
    "notes-widget.uc.js (@version)": extractUserScriptHeaderVersion(),
    "notes-widget.uc.js (VERSION)": extractRuntimeVersion(),
    "README.md (badge)": extractReadmeVersion(),
    "ROADMAP.md (header)": extractRoadmapVersion(),
  };

  const values = Object.values(versions);
  const uniqueValues = [...new Set(values)];

  console.log("Version sync check:\n");
  for (const [file, version] of Object.entries(versions)) {
    console.log(`  ${file.padEnd(35)} ${version || "NOT FOUND"}`);
  }

  if (uniqueValues.length !== 1 || !uniqueValues[0]) {
    console.error("\n❌ Version mismatch detected!");
    process.exit(1);
  }

  console.log(`\n✅ All versions synchronized at ${uniqueValues[0]}`);
}

main();
