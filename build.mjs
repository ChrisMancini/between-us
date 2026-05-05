#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf-8"));
const image = "between-us";

console.log(`Building ${image}:${version}...`);
execSync(`docker build -t ${image}:${version} -t ${image}:latest .`, {
  stdio: "inherit",
});

console.log("");
console.log(`Tagged: ${image}:${version}, ${image}:latest`);
console.log("");
console.log("To export for NAS deployment:");
console.log(`  docker save ${image}:${version} -o between-us.tar`);
