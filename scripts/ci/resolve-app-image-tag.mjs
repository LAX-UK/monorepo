#!/usr/bin/env node
/**
 * Resolve the immutable monorepo SHA Terraform must pin for web/api/ws/worker images.
 * Fails closed when the live App Platform web tag is a rolling env name (test/prod).
 */
import { readAppSpec } from "./assert-app-platform-spec.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let appId = "";
  let inputTag = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-id") {
      appId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--input-tag") {
      inputTag = argv[index + 1] ?? "";
      index += 1;
    }
  }
  if (!appId) {
    throw new Error("--app-id is required");
  }
  return { appId, inputTag: inputTag.trim() };
}

export function readWebImageTagFromSpec(spec) {
  const web = spec?.services?.find((service) => service.name === "web");
  return web?.image?.tag?.trim() ?? "";
}

export function resolveAppImageTag({ inputTag, liveTag }) {
  if (inputTag) {
    if (!SHA_PATTERN.test(inputTag)) {
      throw new Error("--input-tag must be a 40-character lowercase git SHA");
    }
    return inputTag;
  }
  if (!SHA_PATTERN.test(liveTag)) {
    throw new Error(
      `Live web image tag must be a 40-character git SHA (got "${liveTag || "(missing)"}). ` +
        "Run app-deploy-test (or app-deploy-prod) to pin immutable tags before Terraform apply, " +
        "or pass app_image_tag explicitly.",
    );
  }
  return liveTag;
}

function main() {
  const { appId, inputTag } = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  const liveTag = readWebImageTagFromSpec(spec);
  const resolved = resolveAppImageTag({ inputTag, liveTag });
  process.stdout.write(`${resolved}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
