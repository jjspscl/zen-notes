#!/usr/bin/env node
/**
 * validate-header.js — Validates UserScript blocks in all .uc.js files listed in theme.json
 *
 * Required fields:
 *   @name, @version, @description, @author, @include, @run-at
 *
 * Exits with code 1 if the header is malformed or missing required fields.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED = ["name", "version", "description", "author", "include", "run-at"];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function validateFile(file) {
  const content = read(file);
  const headerMatch = content.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);

  if (!headerMatch) {
    console.error(`❌ UserScript header block not found in ${file}`);
    return false;
  }

  const header = headerMatch[1];
  const fields = {};
  const lines = header.split("\n");

  for (const line of lines) {
    const m = line.match(/^\s*\/\/\s*@([\w-]+)\s+(.+)/);
    if (m) {
      fields[m[1]] = m[2].trim();
    }
  }

  const missing = REQUIRED.filter((f) => !fields[f]);

  if (missing.length > 0) {
    console.error(`❌ ${file}: Missing required UserScript fields: ${missing.join(", ")}`);
    return false;
  }

  if (fields.include !== "main") {
    console.warn(`⚠️  ${file}: @include is "${fields.include}", expected "main"`);
  }

  if (!["document-start", "document-end", "document-idle"].includes(fields["run-at"])) {
    console.warn(`⚠️  ${file}: @run-at is "${fields["run-at"]}", expected one of: document-start, document-end, document-idle`);
  }

  console.log(`✅ ${file}: header valid (${Object.keys(fields).length} fields)`);
  return true;
}

function main() {
  const themeJson = JSON.parse(read("theme.json"));
  const scripts = themeJson.scripts || {};
  const files = Object.keys(scripts).filter(f => f.endsWith(".uc.js"));
  if (!files.length) {
    console.error(`❌ No .uc.js files found in theme.json scripts`);
    process.exit(1);
  }
  let allPassed = true;
  for (const file of files) {
    if (!validateFile(file)) allPassed = false;
  }
  if (!allPassed) process.exit(1);
}

main();
