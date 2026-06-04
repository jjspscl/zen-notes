#!/usr/bin/env node
/**
 * validate-version.js — Ensures version strings are synchronized
 * across mod.json, notes-widget.uc.js, README.md, and ROADMAP.md.
 *
 * Exits with code 1 if any mismatch is found.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function extractModJsonVersion() {
  const json = JSON.parse(read("mod.json"));
  return json.version;
}

function extractUserScriptVersion() {
  const content = read("notes-widget.uc.js");
  const m = content.match(/\/\/\s*@version\s+(.+)/);
  return m ? m[1].trim() : null;
}

function extractReadmeVersion() {
  const content = read("README.md");
  const m = content.match(/version-([\d.]+(?:--[a-z]+)?)-blue/);
  return m ? m[1].replace(/--/g, "-") : null;
}

function extractRoadmapVersion() {
  const content = read("ROADMAP.md");
  const m = content.match(/\*\*v([\d.]+(?:-[a-z]+)?)\s*(?:[A-Z][a-z]+)?\*\* —/);
  return m ? m[1] : null;
}

function main() {
  const versions = {
    "mod.json": extractModJsonVersion(),
    "notes-widget.uc.js (// @version)": extractUserScriptVersion(),
    "README.md (badge)": extractReadmeVersion(),
    "ROADMAP.md (header)": extractRoadmapVersion(),
  };

  const values = Object.values(versions);
  const unique = [...new Set(values)];

  console.log("Version sync check:\n");
  for (const [file, version] of Object.entries(versions)) {
    const status = version ? version : "NOT FOUND";
    console.log(`  ${file.padEnd(35)} ${status}`);
  }

  if (unique.length !== 1 || !unique[0]) {
    console.error("\n❌ Version mismatch detected!");
    process.exit(1);
  }

  console.log(`\n✅ All versions synchronized at ${unique[0]}`);
}

main();
