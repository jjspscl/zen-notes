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

const fs = require("node:fs");
const path = require("node:path");
const { ROOT, scriptFiles } = require("./lib/manifest");
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

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

const REPO_URL = "https://github.com/jjspscl/zen-notes";

// Sine only updates when theme.json updatedAt is newer, and it re-reads theme.json from
// the branch named in homepage, so both must follow every release.
function updateSineMetadata(newVersion) {
  const homepage = newVersion.includes("-") ? `${REPO_URL}/tree/beta` : REPO_URL;
  const today = new Date().toISOString();
  const content = read("theme.json")
    .replace(/"homepage":\s*"[^"]*"/, `"homepage": "${homepage}"`)
    .replace(/"updatedAt":\s*"[^"]*"/, `"updatedAt": "${today}"`);
  write("theme.json", content);
  console.log(`  theme.json: homepage ${homepage}, updatedAt ${today}`);
}

function updateUserScriptHeader(newVersion) {
  for (const filename of scriptFiles()) {
    if (!filename.endsWith(".uc.js")) continue;
    const content = read(filename)
      .replace(/\/\/ @version\s+.+/, `// @version         ${newVersion}`)
      .replace(/const VERSION = "[^"]+";/, `const VERSION = "${newVersion}";`);
    write(filename, content);
    console.log(`  ${filename}: header + runtime version updated`);
  }
}

function updateStyleHeader(newVersion) {
  const file = JSON.parse(read("theme.json")).style.chrome;
  write(file, read(file).replace(/\/\* Zen Notes Widget — v[^\s*]+/, `/* Zen Notes Widget — v${newVersion}`));
  console.log(`  ${file}: header updated`);
}

function updatePackageVersion(newVersion) {
  const pkg = JSON.parse(read("package.json"));
  pkg.version = newVersion;
  write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  const lock = JSON.parse(read("package-lock.json"));
  lock.version = newVersion;
  if (lock.packages?.[""]) lock.packages[""].version = newVersion;
  write("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`  package.json + package-lock.json: ${newVersion}`);
}

function updateReadmeBadge(newVersion) {
  const file = "README.md";
  const badgeVersion = newVersion.replace(/-/g, "--");
  const content = read(file).replace(/version-[0-9A-Za-z.]+(?:--[0-9A-Za-z.]+)*-blue/, `version-${badgeVersion}-blue`);
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
  updateSineMetadata(nextVersion);
  updateUserScriptHeader(nextVersion);
  updatePackageVersion(nextVersion);
  updateStyleHeader(nextVersion);
  updateReadmeBadge(nextVersion);
  updateRoadmapVersion(nextVersion);
  console.log(`\nDone. Review changes before release.`);
}

main();
