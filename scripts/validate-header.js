#!/usr/bin/env node
/**
 * validate-header.js — Validates the UserScript block in notes-widget.uc.js
 *
 * Required fields:
 *   @name, @version, @description, @author, @include, @run-at
 *
 * Exits with code 1 if the header is malformed or missing required fields.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = "notes-widget.uc.js";

const REQUIRED = ["name", "version", "description", "author", "include", "run-at"];

function read() {
  return fs.readFileSync(path.join(ROOT, FILE), "utf8");
}

function main() {
  const content = read();
  const headerMatch = content.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);

  if (!headerMatch) {
    console.error(`❌ UserScript header block not found in ${FILE}`);
    process.exit(1);
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
    console.error(`❌ Missing required UserScript fields: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Validate @include is "main" (fx-autoconfig convention for browser chrome)
  if (fields.include !== "main") {
    console.warn(`⚠️  @include is "${fields.include}", expected "main" for browser chrome scripts`);
  }

  // Validate @run-at
  if (!["document-start", "document-end", "document-idle"].includes(fields["run-at"])) {
    console.warn(`⚠️  @run-at is "${fields["run-at"]}", expected one of: document-start, document-end, document-idle`);
  }

  console.log(`✅ UserScript header valid (${Object.keys(fields).length} fields)`);
}

main();
