#!/usr/bin/env node
/**
 * validate-theme.js — Basic validation for Sine theme.json metadata.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function main() {
  const themePath = path.join(ROOT, "theme.json");
  const raw = fs.readFileSync(themePath, "utf8");
  const theme = JSON.parse(raw);

  const requiredFields = ["id", "name", "description", "author", "version", "homepage", "readme", "fork", "style", "scripts", "preferences"];
  for (const field of requiredFields) {
    if (!(field in theme)) {
      fail(`theme.json is missing required field: ${field}`);
    }
  }

  if (!theme.style || typeof theme.style.chrome !== "string") {
    fail("theme.json must define style.chrome");
  }

  if (!theme.scripts || Object.keys(theme.scripts).length === 0) {
    fail("theme.json must define at least one script in scripts");
  }

  for (const [filename, meta] of Object.entries(theme.scripts)) {
    if (!Array.isArray(meta.include) || meta.include.length === 0) {
      fail(`theme.json script "${filename}" must have a non-empty include list`);
    }
    if (!fs.existsSync(path.join(ROOT, filename))) {
      fail(`theme.json script "${filename}" not found on disk`);
    }
  }

  const localFiles = [theme.style.chrome, theme.preferences, "README.md"];
  for (const file of localFiles) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      fail(`theme.json references missing file: ${file}`);
    }
  }

  console.log(`✅ theme.json valid (${theme.id} @ ${theme.version})`);
}

main();
