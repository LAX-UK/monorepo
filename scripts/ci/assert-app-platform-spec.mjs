#!/usr/bin/env node
/**
 * Guard App Platform spec: image tags match deploy SHA and spec must not override
 * image-owned SENTRY_RELEASE.
 */
import { spawnSync } from "node:child_process";

const PINNED_COMPONENTS = ["api", "ws", "worker", "web", "migrate", "clamav"];

function parseArgs(argv) {
  let appId;
  let expectedTag;
  let mode = "post";
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
      continue;
    }
    if (arg === "--mode") {
      mode = argv[index + 1] ?? "post";
      index += 1;
    }
  }
  if (!appId) throw new Error("--app-id is required");
  if (mode === "post" && (!expectedTag || !/^[0-9a-f]{40}$|^test$|^prod$/.test(expectedTag))) {
    throw new Error("--expected-tag must be a git SHA or rolling env tag when --mode post");
  }
  if (mode !== "pre" && mode !== "post") {
    throw new Error("--mode must be pre or post");
  }
  return { appId, expectedTag, mode };
}

export function readAppSpec(appId) {
  const result = spawnSync("doctl", ["apps", "get", appId, "--output", "json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`doctl apps get failed: ${result.stderr?.trim() || "unknown"}`);
  }
  const parsed = JSON.parse(result.stdout);
  return Array.isArray(parsed) ? parsed[0]?.spec : parsed.spec;
}

export function collectReleaseEnvOverrides(spec) {
  const violations = [];
  const kinds = [
    ["services", spec?.services ?? []],
    ["workers", spec?.workers ?? []],
    ["jobs", spec?.jobs ?? []],
  ];
  for (const [kind, components] of kinds) {
    for (const component of components) {
      for (const env of component.envs ?? component.env ?? []) {
        if (env.key === "SENTRY_RELEASE") {
          violations.push({
            component: component.name ?? "unknown",
            kind,
            value: env.value ?? "",
          });
        }
      }
    }
  }
  return violations;
}

export function assertPinnedImageTags(spec, expectedTag) {
  const mismatches = [];
  for (const name of PINNED_COMPONENTS) {
    const service = spec?.services?.find((entry) => entry.name === name);
    const worker = spec?.workers?.find((entry) => entry.name === name);
    const job = spec?.jobs?.find((entry) => entry.name === name);
    const component = service ?? worker ?? job;
    if (!component?.image?.tag) continue;
    if (component.image.tag !== expectedTag) {
      mismatches.push({
        name,
        tag: component.image.tag,
        registry: component.image.registry ?? "unknown",
        repository: component.image.repository ?? "unknown",
      });
    }
  }
  return mismatches;
}

export function assertAppPlatformSpec({ spec, expectedTag, mode }) {
  const releaseOverrides = collectReleaseEnvOverrides(spec);
  if (releaseOverrides.length > 0) {
    const details = releaseOverrides
      .map(
        (entry) =>
          `${entry.kind}/${entry.component} sets SENTRY_RELEASE=${entry.value} (spec overrides image-owned release)`,
      )
      .join("; ");
    throw new Error(details);
  }
  if (mode === "post") {
    const mismatches = assertPinnedImageTags(spec, expectedTag);
    if (mismatches.length > 0) {
      const details = mismatches
        .map(
          (entry) =>
            `${entry.name}.image.tag is ${entry.tag}, expected ${expectedTag} (${entry.registry}/${entry.repository})`,
        )
        .join("; ");
      throw new Error(details);
    }
  }
}

function main() {
  const { appId, expectedTag, mode } = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  assertAppPlatformSpec({ spec, expectedTag, mode });
  if (mode === "pre") {
    console.log("App Platform spec has no SENTRY_RELEASE env overrides");
    return;
  }
  console.log(`App Platform pinned component tags match ${expectedTag}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
