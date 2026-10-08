#!/usr/bin/env node
import { componentRepository } from "./deploy-tag-map.mjs";
import { digestForTag, listTags, waitForShaTag } from "./registry-tag-poll.mjs";

const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let environment = "";
  let deploySha = "";
  let tagMapJson = "{}";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--environment") environment = argv[++i] ?? "";
    if (argv[i] === "--deploy-sha") deploySha = argv[++i] ?? "";
    if (argv[i] === "--tag-map") tagMapJson = argv[++i] ?? "{}";
  }
  if (!/^(test|prod)$/.test(environment)) {
    throw new Error("--environment must be test or prod");
  }
  if (!SHA.test(deploySha)) {
    throw new Error("--deploy-sha must be a 40-char commit SHA");
  }
  return { environment, deploySha, tagMap: JSON.parse(tagMapJson) };
}

async function verifyComponent(repository, sha) {
  const tags = listTags(repository);
  let digest = digestForTag(tags, sha);
  if (!digest) {
    digest = await waitForShaTag(repository, sha, { maxAttempts: 12, initialDelayMs: 5_000 });
  }
  console.log(`${repository}:${sha} ok (${digest})`);
}

async function main() {
  const { environment, deploySha, tagMap } = parseArgs(process.argv.slice(2));
  for (const [component, tag] of Object.entries(tagMap)) {
    if (tag !== deploySha) continue;
    await verifyComponent(componentRepository(environment, component), deploySha);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
