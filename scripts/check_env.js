#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
  console.error(".env file not found at", envPath);
  process.exit(2);
}
const content = fs.readFileSync(envPath, "utf8");
const lines = content.split(/\r?\n/);
const vars = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("{")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  vars[key] = val;
}
const required = [
  "APIFY_TOKEN",
  "APIFY_LINKEDIN_ACTOR_ID",
  "APOLLO_API_URL",
  "APOLLO_API_KEY",
];
const optional = ["LEADMAGIC_API_URL", "LEADMAGIC_API_KEY"];
console.log("Checking env variables:\n");
let allPresent = true;
for (const k of required) {
  const v = vars[k];
  if (!v) {
    console.log(`${k}: MISSING`);
    allPresent = false;
  } else {
    const masked = v.length > 8 ? v.slice(0, 6) + "..." + v.slice(-2) : v;
    console.log(`${k}: present (${masked})`);
  }
}
console.log("\nOptional variables:");
for (const k of optional) {
  const v = vars[k];
  console.log(v ? `${k}: present` : `${k}: not configured (optional)`);
}
console.log(
  "\nSummary: " +
    (allPresent
      ? "Required variables present"
      : "Some required variables missing"),
);
process.exit(allPresent ? 0 : 1);
