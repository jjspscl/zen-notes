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

  if (!theme.scripts || !theme.scripts["notes-widget.uc.js"]) {
    fail("theme.json must define notes-widget.uc.js in scripts");
  }

  const scriptMeta = theme.scripts["notes-widget.uc.js"];
  if (!Array.isArray(scriptMeta.include) || scriptMeta.include.length === 0) {
    fail("theme.json script include list must be non-empty");
  }

  const localFiles = [theme.style.chrome, theme.preferences, "notes-widget.uc.js", "README.md"];
  for (const file of localFiles) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      fail(`theme.json references missing file: ${file}`);
    }
  }

  console.log(`✅ theme.json valid (${theme.id} @ ${theme.version})`);
}

main();
