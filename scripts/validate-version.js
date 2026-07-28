#!/usr/bin/env node
/**
 * validate-version.js — Ensures version strings are synchronized
 * across theme.json, mod.json, all .uc.js scripts, README.md, and ROADMAP.md.
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

function extractUserScriptHeaderVersion(file) {
  const match = read(file).match(/\/\/\s*@version\s+(.+)/);
  return match ? match[1].trim() : null;
}

function extractRuntimeVersion(file) {
  const match = read(file).match(/const VERSION = "([^"]+)";/);
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

function getScriptFiles() {
  const theme = JSON.parse(read("theme.json"));
  const scripts = theme.scripts || {};
  return Object.keys(scripts).filter(f => f.endsWith(".uc.js"));
}

function main() {
  const versions = {
    "theme.json": extractJsonVersion("theme.json"),
    "mod.json": extractJsonVersion("mod.json"),
    "README.md (badge)": extractReadmeVersion(),
    "ROADMAP.md (header)": extractRoadmapVersion(),
  };
  for (const file of getScriptFiles()) {
    versions[`${file} (@version)`] = extractUserScriptHeaderVersion(file);
    const runtime = extractRuntimeVersion(file);
    if (runtime !== null) versions[`${file} (VERSION)`] = runtime;
  }

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
