/** Shared helpers for reading the Sine manifest (theme.json) and runtime files. */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const readBytes = (file) => fs.readFileSync(path.join(ROOT, file));
const readJson = (file) => JSON.parse(read(file));
const exists = (file) => fs.existsSync(path.join(ROOT, file));

/** Flattens the (possibly nested) `scripts` map of theme.json into `{ "dir/file.uc.js": meta }`. */
function scriptMap(scripts = readJson("theme.json").scripts, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(scripts || {})) {
    const file = prefix ? `${prefix}/${key}` : key;
    if (/\.(uc\.js|uc\.mjs|sys\.mjs)$/.test(file)) result[file] = value;
    else if (value && typeof value === "object") Object.assign(result, scriptMap(value, file));
  }
  return result;
}

const scriptFiles = () => Object.keys(scriptMap());

module.exports = { ROOT, read, readBytes, readJson, exists, scriptMap, scriptFiles };
