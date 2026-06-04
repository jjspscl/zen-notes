#!/usr/bin/env node
/**
 * build-release.js — Assembles the release ZIP package
 *
 * Output: dist/zen-notes-{version}.zip
 *
 * Structure (namespaced):
 *   zen-notes/
 *   ├── chrome/
 *   │   ├── JS/
 *   │   │   └── notes-widget.uc.js
 *   │   └── preferences.json
 *   ├── userChrome.css          (style.css renamed)
 *   ├── mod.json
 *   └── install.md
 *   README.md (at root of ZIP)
 *
 * Usage: node scripts/build-release.js
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
  const modJson = JSON.parse(read("mod.json"));
  const version = modJson.version;
  const zipName = `zen-notes-${version}.zip`;

  // Clean and recreate dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const pkgDir = path.join(DIST, "zen-notes");
  fs.mkdirSync(pkgDir, { recursive: true });

  // Chrome folder contents
  const chromeDir = path.join(pkgDir, "chrome");
  fs.mkdirSync(path.join(chromeDir, "JS"), { recursive: true });

  cp("notes-widget.uc.js", path.join(chromeDir, "JS", "notes-widget.uc.js"));
  cp("preferences.json", path.join(chromeDir, "preferences.json"));
  cp("style.css", path.join(pkgDir, "userChrome.css"));
  cp("mod.json", path.join(pkgDir, "mod.json"));
  cp("README.md", path.join(pkgDir, "README.md"));

  if (fs.existsSync(path.join(ROOT, "install.md"))) {
    cp("install.md", path.join(pkgDir, "install.md"));
  }

  // Also copy README to zip root
  cp("README.md", path.join(DIST, "README.md"));

  // Create archive
  const zipPath = path.join(ROOT, zipName);
  let archivePath = zipPath;
  let archiveSize = 0;

  try {
    execSync(`cd "${DIST}" && zip -r "${zipPath}" .`, { stdio: "pipe" });
    archiveSize = fs.statSync(zipPath).size;
  } catch (e) {
    // zip not available (e.g. minimal Linux env), try tar.gz fallback
    const tarName = `zen-notes-${version}.tar.gz`;
    const tarPath = path.join(ROOT, tarName);
    try {
      execSync(`cd "${DIST}" && tar -czf "${tarPath}" .`, { stdio: "pipe" });
      archivePath = tarPath;
      archiveSize = fs.statSync(tarPath).size;
      console.warn(`\n⚠️  'zip' not found. Created tar.gz instead.`);
    } catch (tarErr) {
      console.warn(`\n⚠️  Neither 'zip' nor 'tar' available. Dist folder left at: ${DIST}`);
      console.log(`   Version: ${version}`);
      process.exit(0);
    }
  }

  // Clean up dist
  fs.rmSync(DIST, { recursive: true });

  console.log(`\n✅ Release package: ${archivePath}`);
  console.log(`   Version: ${version}`);
  console.log(`   Size: ${(archiveSize / 1024).toFixed(1)} KB`);
}

main();
