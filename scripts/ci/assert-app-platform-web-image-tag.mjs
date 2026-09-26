#!/usr/bin/env node
/**
 * Assert live App Platform spec pins the web service to the expected DOCR tag.
 */
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  let appId;
  let expectedTag;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-id") {
      appId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--expected-tag") {
      expectedTag = argv[index + 1];
      index += 1;
    }
  }
  if (!appId) throw new Error("--app-id is required");
  if (!expectedTag || !/^[0-9a-f]{40}$|^test$|^prod$/.test(expectedTag)) {
    throw new Error("--expected-tag must be a git SHA or rolling env tag");
  }
  return { appId, expectedTag };
}

function readWebImageTag(appId) {
  const result = spawnSync("doctl", ["apps", "get", appId, "--output", "json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`doctl apps get failed: ${result.stderr?.trim() || "unknown"}`);
  }
  const parsed = JSON.parse(result.stdout);
  const spec = Array.isArray(parsed) ? parsed[0]?.spec : parsed.spec;
  const web = spec?.services?.find((service) => service.name === "web");
  if (!web?.image?.tag) {
    throw new Error("App spec has no web.image.tag");
  }
  return {
    tag: web.image.tag,
    registry: web.image.registry ?? "unknown",
    repository: web.image.repository ?? "unknown",
  };
}

function main() {
  const { appId, expectedTag } = parseArgs(process.argv.slice(2));
  const web = readWebImageTag(appId);
  if (web.tag !== expectedTag) {
    throw new Error(
      `App Platform web.image.tag is ${web.tag}, expected ${expectedTag} (registry ${web.registry}, repo ${web.repository})`,
    );
  }
  console.log(`App Platform web.image.tag matches ${expectedTag}`);
}

main();
