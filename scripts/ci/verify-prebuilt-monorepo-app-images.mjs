#!/usr/bin/env node
/**
 * Fail closed before Terraform apply when DOCR lacks immutable tags for every
 * component that shares TF_VAR_app_image_tag (api, ws, worker, web, migrate, clamav).
 */
import { digestForTag, listTags, waitForShaTag } from "./registry-tag-poll.mjs";

const APP_IMAGE_COMPONENTS = ["api", "ws", "worker", "web", "migrate", "clamav"];

function parseArgs(argv) {
  let environment = "";
  let sha = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--environment") environment = argv[++i] ?? "";
    if (argv[i] === "--sha") sha = argv[++i] ?? "";
  }
  if (!/^(test|prod)$/.test(environment)) {
    throw new Error("--environment must be test or prod");
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("--sha must be a 40-char commit SHA");
  }
  return { environment, sha };
}

async function verifyRepository(repository, sha) {
  let digest = digestForTag(listTags(repository), sha);
  if (!digest) {
    digest = await waitForShaTag(repository, sha, { maxAttempts: 12, initialDelayMs: 5_000 });
  }
  console.log(`${repository}:${sha} ok (${digest})`);
}

async function main() {
  const { environment, sha } = parseArgs(process.argv.slice(2));
  for (const component of APP_IMAGE_COMPONENTS) {
    await verifyRepository(`lax-${environment}-${component}`, sha);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
