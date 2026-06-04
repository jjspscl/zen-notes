#!/usr/bin/env node
/**
 * validate-css.js — Basic CSS validation for style.css
 *
 * Checks:
 *   - All braces are balanced (open == close)
 *   - No unclosed @media, @supports, or @keyframes blocks
 *   - CSS file is non-empty
 *
 * This is a lightweight syntax check. It does not validate against
 * the CSS spec (no full parser), but catches the most common issues
 * that silently break userChrome.css loading in Firefox/Zen.
 *
 * Exits with code 1 if any check fails.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = "style.css";

function read() {
  return fs.readFileSync(path.join(ROOT, FILE), "utf8");
}

function main() {
  const css = read();

  if (css.trim().length === 0) {
    console.error(`❌ ${FILE} is empty`);
    process.exit(1);
  }

  // Remove strings and comments to avoid false positives
  const stripped = css
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;

  if (open !== close) {
    console.error(`❌ ${FILE}: brace mismatch — ${open} open, ${close} close`);
    process.exit(1);
  }

  // Check for unclosed @media
  const atRules = stripped.match(/@\w+[^;{]*\{/g) || [];
  let depth = 0;
  for (const char of stripped) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth < 0) {
      console.error(`❌ ${FILE}: unexpected closing brace (unbalanced)`);
      process.exit(1);
    }
  }

  if (depth !== 0) {
    console.error(`❌ ${FILE}: unclosed block(s) — depth=${depth}`);
    process.exit(1);
  }

  console.log(`✅ ${FILE} syntax OK (${open} blocks, ${atRules.length} @-rules)`);
}

main();
