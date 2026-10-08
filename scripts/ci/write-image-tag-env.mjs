#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { COMPONENT_TO_IMAGE_TAG_ENV } from "./deploy-tag-map.mjs";

function main() {
  const mapJson = process.argv[2];
  if (!mapJson) throw new Error("Usage: write-image-tag-env.mjs '<json map>'");
  const map = JSON.parse(mapJson);
  const out = process.env.GITHUB_ENV;
  if (!out) throw new Error("GITHUB_ENV is required");
  for (const [component, tag] of Object.entries(map)) {
    const key = COMPONENT_TO_IMAGE_TAG_ENV[component];
    if (!key) continue;
    appendFileSync(out, `${key}=${tag}\n`);
  }
}

main();
