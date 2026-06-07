#!/usr/bin/env node
/**
 * build-release.js — Assembles a GitHub release archive.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, src), dest);
}

function main() {
  const themeJson = JSON.parse(read("theme.json"));
  const version = themeJson.version;
  const zipName = `zen-notes-${version}.zip`;

  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const pkgDir = path.join(DIST, "zen-notes");
  fs.mkdirSync(pkgDir, { recursive: true });

  cp("notes-widget.uc.js", path.join(pkgDir, "notes-widget.uc.js"));
  cp("style.css", path.join(pkgDir, "style.css"));
  cp("preferences.json", path.join(pkgDir, "preferences.json"));
  cp("theme.json", path.join(pkgDir, "theme.json"));
  cp("mod.json", path.join(pkgDir, "mod.json"));
  cp("README.md", path.join(pkgDir, "README.md"));

  if (fs.existsSync(path.join(ROOT, "install.md"))) {
    cp("install.md", path.join(pkgDir, "install.md"));
  }

  const archivePath = path.join(ROOT, zipName);
  execSync(`zip -r "${archivePath}" .`, { cwd: DIST, stdio: "pipe" });
  const archiveSize = fs.statSync(archivePath).size;

  fs.rmSync(DIST, { recursive: true });

  console.log(`\n✅ Release package: ${archivePath}`);
  console.log(`   Version: ${version}`);
  console.log(`   Size: ${(archiveSize / 1024).toFixed(1)} KB`);
}

main();
