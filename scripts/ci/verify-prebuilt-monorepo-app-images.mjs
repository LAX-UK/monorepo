#!/usr/bin/env node
/**
 * Fail closed before Terraform apply when DOCR lacks immutable tags for the monorepo
 * app components (api, ws, worker, web, migrate), or for the components named with
 * repeated --component flags. ClamAV is excluded: build-images only rebuilds it when it
 * changes, and no environment deploys it from that tag (prod builds it from source; test
 * has no clamav component).
 *
 * Use --sha to expect one SHA for every selected component, or repeated
 * --pin <component>=<sha> when App deploy test left components on different SHAs.
 */
import { pathToFileURL } from "node:url";
import { digestForTag, listTags, waitForShaTag } from "./registry-tag-poll.mjs";

const APP_IMAGE_COMPONENTS = ["api", "ws", "worker", "web", "migrate"];
const SHA = /^[0-9a-f]{40}$/;

export function parseArgs(argv) {
  let environment = "";
  let sha = "";
  const components = [];
  const pins = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--environment") environment = argv[++i] ?? "";
    if (argv[i] === "--sha") sha = argv[++i] ?? "";
    if (argv[i] === "--component") components.push(argv[++i] ?? "");
    if (argv[i] === "--pin") {
      const [component, pinSha] = (argv[++i] ?? "").split("=");
      if (!/^[a-z][a-z-]*$/.test(component ?? "") || !SHA.test(pinSha ?? "")) {
        throw new Error("--pin must be <component>=<40-char commit SHA>");
      }
      pins.set(component, pinSha);
    }
  }
  if (!/^(test|prod)$/.test(environment)) {
    throw new Error("--environment must be test or prod");
  }
  if (pins.size > 0 && sha) {
    throw new Error("--pin and --sha are mutually exclusive");
  }
  if (pins.size === 0 && !SHA.test(sha)) {
    throw new Error("--sha must be a 40-char commit SHA");
  }
  if (components.some((component) => !/^[a-z][a-z-]*$/.test(component))) {
    throw new Error("--component must be a lowercase component name");
  }
  return { environment, sha, components, pins };
}

/** Returns the [repository, sha] pairs that must exist in DOCR. */
export function planVerification({ environment, sha, components, pins }) {
  if (pins.size > 0) {
    const selected = components.length ? components : [...pins.keys()];
    return selected.map((component) => {
      const pinned = pins.get(component);
      if (!pinned) throw new Error(`No --pin given for component "${component}"`);
      return [`lax-${environment}-${component}`, pinned];
    });
  }
  const selected = components.length ? components : APP_IMAGE_COMPONENTS;
  return selected.map((component) => [`lax-${environment}-${component}`, sha]);
}

export async function verifyRepository(
  repository,
  sha,
  { list = listTags, digestFor = digestForTag, wait = waitForShaTag, log = console.log } = {},
) {
  let digest = digestFor(list(repository), sha);
  if (!digest) {
    digest = await wait(repository, sha, {
      maxAttempts: 12,
      initialDelayMs: 5_000,
    });
  }
  log(`${repository}:${sha} ok (${digest})`);
  return digest;
}

async function main() {
  const plan = planVerification(parseArgs(process.argv.slice(2)));
  for (const [repository, sha] of plan) {
    await verifyRepository(repository, sha);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
