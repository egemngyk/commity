#!/usr/bin/env node
/**
 * pre-publish.js
 * 
 * Patches package.json before publishing to a store (VS Code Marketplace / OpenVSX).
 * Sets commity.enableAutoUpdater default to false so store installs don't
 * try to self-update from GitHub (the store handles updates).
 *
 * Usage:
 *   node scripts/pre-publish.js         -> patches (store mode)
 *   node scripts/pre-publish.js --reset -> restores to true (GitHub mode)
 */

const fs = require("fs");
const path = require("path");

const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const reset = process.argv.includes("--reset");
const targetValue = reset ? true : false;

const props = pkg.contributes?.configuration?.properties;
if (props && props["commity.enableAutoUpdater"]) {
  props["commity.enableAutoUpdater"].default = targetValue;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`[pre-publish] commity.enableAutoUpdater.default set to: ${targetValue}`);
} else {
  console.error("[pre-publish] Could not find commity.enableAutoUpdater in package.json!");
  process.exit(1);
}
