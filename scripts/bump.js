#!/usr/bin/env node
/**
 * bump.js — Automated version bump for Zen Notes Widget
 *
 * Usage:
 *   node scripts/bump.js patch
 *   node scripts/bump.js minor
 *   node scripts/bump.js major
 *   node scripts/bump.js 2.0.0-beta
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VERSION_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content, "utf8");
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

function bump(version, type) {
  const current = parseVersion(version);
  if (type === "major") return `${current.major + 1}.0.0`;
  if (type === "minor") return `${current.major}.${current.minor + 1}.0`;
  if (type === "patch") return `${current.major}.${current.minor}.${current.patch + 1}`;
  return type;
}

function updateJsonVersion(file, newVersion) {
  const content = read(file);
  write(file, content.replace(/"version":\s*"[^"]+"/, `"version": "${newVersion}"`));
  console.log(`  ${file}: ${newVersion}`);
}

function updateUserScriptHeader(newVersion) {
  const file = "notes-widget.uc.js";
  const content = read(file)
    .replace(/\/\/ @version\s+.+/, `// @version         ${newVersion}`)
    .replace(/const VERSION = "[^"]+";/, `const VERSION = "${newVersion}";`);
  write(file, content);
  console.log(`  ${file}: header + runtime version updated`);
}

function updateReadmeBadge(newVersion) {
  const file = "README.md";
  const badgeVersion = newVersion.replace(/-/g, "--");
  const content = read(file).replace(/version-[^-]+-blue/, `version-${badgeVersion}-blue`);
  write(file, content);
  console.log(`  ${file}: badge updated`);
}

function updateRoadmapVersion(newVersion) {
  const file = "ROADMAP.md";
  const content = read(file).replace(/\*\*v[\dA-Za-z.-]+\*\*/, `**v${newVersion}**`);
  write(file, content);
  console.log(`  ${file}: current version updated`);
}

function main() {
  const type = process.argv[2];
  if (!type || (!["patch", "minor", "major"].includes(type) && !VERSION_PATTERN.test(type))) {
    console.error("Usage: node scripts/bump.js [patch|minor|major|x.y.z[-tag]]");
    process.exit(1);
  }

  const currentVersion = JSON.parse(read("theme.json")).version;
  const nextVersion = bump(currentVersion, type);

  console.log(`Bumping ${currentVersion} → ${nextVersion}\n`);
  updateJsonVersion("theme.json", nextVersion);
  updateJsonVersion("mod.json", nextVersion);
  updateUserScriptHeader(nextVersion);
  updateReadmeBadge(nextVersion);
  updateRoadmapVersion(nextVersion);
  console.log(`\nDone. Review changes before release.`);
}

main();
