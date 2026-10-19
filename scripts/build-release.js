#!/usr/bin/env node
/**
 * build-release.js — Assembles a GitHub release archive.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const { ROOT, exists, scriptFiles } = require("./lib/manifest");
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

  // Only runtime files ship: scripts + stylesheet listed in theme.json, plus Sine metadata and docs.
  const runtime = [...scriptFiles(), themeJson.style.chrome];
  const support = ["preferences.json", "theme.json", "mod.json", "README.md", "LICENSE", "install.md"];
  for (const file of [...runtime, ...support]) {
    if (!exists(file)) throw new Error(`[build-release] "${file}" not found`);
    cp(file, path.join(pkgDir, file));
  }

  const archivePath = path.join(ROOT, zipName);
  if (fs.existsSync(archivePath)) fs.rmSync(archivePath);
  let archiveSize;
  try {
    execSync(`zip -r "${archivePath}" .`, { cwd: DIST, stdio: "pipe" });
    archiveSize = fs.statSync(archivePath).size;
  } catch (error) {
    if (fs.existsSync(archivePath)) fs.rmSync(archivePath);
    throw error;
  } finally {
    if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  }

  console.log(`\n✅ Release package: ${archivePath}`);
  console.log(`   Version: ${version}`);
  console.log(`   Size: ${(archiveSize / 1024).toFixed(1)} KB`);
}

main();
