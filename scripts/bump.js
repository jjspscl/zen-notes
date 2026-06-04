#!/usr/bin/env node
/**
 * bump.js — Automated version bump for Zen Notes Widget
 *
 * Usage:
 *   node scripts/bump.js patch   # 0.2.2 → 0.2.3
 *   node scripts/bump.js minor   # 0.2.2 → 0.3.0
 *   node scripts/bump.js major   # 0.2.2 → 1.0.0
 *   node scripts/bump.js 1.0.0   # explicit version
 *
 * Updates:
 *   - mod.json → version
 *   - notes-widget.uc.js → // @version
 *   - README.md → badge
 *   - ROADMAP.md → current version line
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content, "utf8");
}

function parseVersion(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) throw new Error("Invalid version format: " + v);
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || "",
    raw: v,
  };
}

function bump(version, type) {
  const v = parseVersion(version);
  let next;
  if (type === "major") {
    next = `${v.major + 1}.0.0`;
  } else if (type === "minor") {
    next = `${v.major}.${v.minor + 1}.0`;
  } else if (type === "patch") {
    next = `${v.major}.${v.minor}.${v.patch + 1}`;
  } else {
    next = type; // explicit version string
  }
  // Preserve prerelease suffix if not explicitly overridden
  if (type !== "major" && type !== "minor" && type !== "patch" && !type.includes("-")) {
    // explicit version without suffix, keep existing suffix if any
    if (v.prerelease) next += "-" + v.prerelease;
  }
  return next;
}

function updateModJson(newVersion) {
  const file = "mod.json";
  const content = read(file);
  const updated = content.replace(
    /"version":\s*"[^"]+"/,
    `"version": "${newVersion}"`
  );
  write(file, updated);
  console.log(`  ${file}: ${newVersion}`);
}

function updateUserScriptHeader(newVersion) {
  const file = "notes-widget.uc.js";
  const content = read(file);
  const updated = content.replace(
    /\/\/ @version\s+.+/,    
    `// @version         ${newVersion}`
  );
  write(file, updated);
  console.log(`  ${file}: // @version ${newVersion}`);
}

function updateReadme(newVersion) {
  const file = "README.md";
  const content = read(file);
  const badgeVersion = newVersion.replace(/-/g, "--");
  const updated = content.replace(
    /version-\d+\.\d+\.\d+(?:--[a-z]+)?-blue/,
    `version-${badgeVersion}-blue`
  );
  write(file, updated);
  console.log(`  ${file}: badge updated`);
}

function updateRoadmap(newVersion) {
  const file = "ROADMAP.md";
  const content = read(file);
  // Update the "Current Version" line
  const updated = content.replace(
    /\*\*v[\d.]+(?:-[a-z]+)?\*\* — .+$/m,
    `**v${newVersion}** — CI/CD pipeline and release automation.`
  );
  write(file, updated);
  console.log(`  ${file}: current version updated`);
}

function main() {
  const args = process.argv.slice(2);
  const type = args[0];

  if (!type || ["patch", "minor", "major"].includes(type) === false && !/^\d+\.\d+\.\d+/.test(type)) {
    console.error(`Usage: node scripts/bump.js [patch|minor|major|x.y.z]`);
    process.exit(1);
  }

  const modJson = JSON.parse(read("mod.json"));
  const current = modJson.version;
  const next = bump(current, type);

  console.log(`Bumping ${current} → ${next}\n`);

  updateModJson(next);
  updateUserScriptHeader(next);
  updateReadme(next);
  updateRoadmap(next);

  console.log(`\nDone. Review changes, then:`);
  console.log(`  git add -A && git commit -m "chore: bump version to v${next}"`);
  console.log(`  git tag v${next}`);
  console.log(`  git push origin v${next}`);
}

main();
