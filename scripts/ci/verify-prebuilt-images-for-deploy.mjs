#!/usr/bin/env node
import { imageRepositoryForComponent, readAppSpec } from "./assert-app-platform-spec.mjs";
import { componentRepository } from "./deploy-tag-map.mjs";
import { digestForTag, listTags, waitForShaTag } from "./registry-tag-poll.mjs";

const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let environment = "";
  let deploySha = "";
  let tagMapJson = "{}";
  let appId = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--environment") environment = argv[++i] ?? "";
    if (argv[i] === "--deploy-sha") deploySha = argv[++i] ?? "";
    if (argv[i] === "--tag-map") tagMapJson = argv[++i] ?? "{}";
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
  }
  if (!/^(test|prod)$/.test(environment)) {
    throw new Error("--environment must be test or prod");
  }
  if (!SHA.test(deploySha)) {
    throw new Error("--deploy-sha must be a 40-char commit SHA");
  }
  return { environment, deploySha, tagMap: JSON.parse(tagMapJson), appId };
}

async function verifyComponent(repository, sha) {
  const tags = listTags(repository);
  let digest = digestForTag(tags, sha);
  if (!digest) {
    digest = await waitForShaTag(repository, sha, { maxAttempts: 12, initialDelayMs: 5_000 });
  }
  console.log(`${repository}:${sha} ok (${digest})`);
}

function repositoryForComponent(spec, environment, component) {
  return (
    imageRepositoryForComponent(spec, component) ?? componentRepository(environment, component)
  );
}

async function main() {
  const { environment, deploySha, tagMap, appId } = parseArgs(process.argv.slice(2));
  const spec = appId ? readAppSpec(appId) : null;

  for (const [component, tag] of Object.entries(tagMap)) {
    if (!SHA.test(tag ?? "")) {
      throw new Error(`Tag map entry ${component} must be a 40-char SHA`);
    }
    const repository = spec
      ? repositoryForComponent(spec, environment, component)
      : componentRepository(environment, component);

    if (component === "auth" && repository.includes("identity") && tag === deploySha) {
      throw new Error(
        `Auth still uses ${repository} in App Platform; run Terraform test up (lax-test-auth cutover) before pinning monorepo auth SHA ${deploySha}`,
      );
    }

    await verifyComponent(repository, tag);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
