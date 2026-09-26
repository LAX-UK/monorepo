#!/usr/bin/env node
/**
 * Fail closed before App Platform pin when DOCR does not have the expected web image.
 */
import { digestForTag, listTags, waitForTagDigest } from "./registry-tag-poll.mjs";

function parseArgs(argv) {
  let environment;
  let sha;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--environment") {
      environment = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--sha") {
      sha = argv[index + 1];
      index += 1;
    }
  }
  if (!environment || !/^(test|prod)$/.test(environment)) {
    throw new Error("--environment must be test or prod");
  }
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("--sha must be a 40-char commit SHA");
  }
  return { environment, sha };
}

async function main() {
  const { environment, sha } = parseArgs(process.argv.slice(2));
  const repository = `lax-${environment}-web`;
  const tags = listTags(repository);
  const shaDigest = digestForTag(tags, sha);
  if (!shaDigest) {
    throw new Error(
      `DOCR ${repository} is missing immutable tag ${sha}; build-images must finish before deploy`,
    );
  }
  const rollingDigest = digestForTag(tags, environment);
  if (rollingDigest !== shaDigest) {
    await waitForTagDigest(repository, environment, shaDigest, {
      maxAttempts: 6,
      initialDelayMs: 2_000,
    });
  }
  console.log(`${repository}:${sha} and :${environment} resolve to ${shaDigest}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
