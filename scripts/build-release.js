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

  const scripts = themeJson.scripts || {};
  for (const filename of Object.keys(scripts)) {
    if (fs.existsSync(path.join(ROOT, filename))) {
      cp(filename, path.join(pkgDir, filename));
    } else {
      console.warn(`[build-release] script "${filename}" listed in theme.json not found, skipping`);
    }
  }

  const supportFiles = ["style.css", "preferences.json", "theme.json", "mod.json", "README.md"];
  for (const file of supportFiles) {
    cp(file, path.join(pkgDir, file));
  }

  if (fs.existsSync(path.join(ROOT, "install.md"))) {
    cp("install.md", path.join(pkgDir, "install.md"));
  }

  const archivePath = path.join(ROOT, zipName);
  if (fs.existsSync(archivePath)) fs.rmSync(archivePath);
  execSync(`zip -r "${archivePath}" .`, { cwd: DIST, stdio: "pipe" });
  const archiveSize = fs.statSync(archivePath).size;

  fs.rmSync(DIST, { recursive: true });

  console.log(`\n✅ Release package: ${archivePath}`);
  console.log(`   Version: ${version}`);
  console.log(`   Size: ${(archiveSize / 1024).toFixed(1)} KB`);
}

main();
