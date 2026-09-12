#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
import { digestForTag, listTags } from "./registry-tag-poll.mjs";

const environment = process.env.ENVIRONMENT;
const gitSha = process.env.GIT_SHA;
const buildRunId = process.env.GITHUB_RUN_ID;
const registry = (process.env.DOCR_REGISTRY ?? "registry.digitalocean.com/lax-bid").replace(
  /\/+$/,
  "",
);
const outputPath = process.env.RELEASE_MANIFEST_OUT ?? "release-manifest.json";
const sourceRepository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";

if (!environment || !/^[0-9a-f]{40}$/.test(gitSha ?? "")) {
  throw new Error("Set ENVIRONMENT and GIT_SHA");
}

const components = (process.env.RELEASE_COMPONENTS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (components.length === 0) {
  throw new Error("Set RELEASE_COMPONENTS to a comma-separated component list");
}

const manifest = {
  repository: sourceRepository,
  environment,
  commitSha: gitSha,
  buildRun: buildRunId,
  registry,
  components: [],
};

for (const component of components) {
  const repository = `lax-${environment}-${component}`;
  const tags = listTags(repository);
  const digest = digestForTag(tags, gitSha);
  if (!digest) {
    throw new Error(`Missing immutable tag ${gitSha} for ${repository}`);
  }
  manifest.components.push({
    component,
    repository,
    commitSha: gitSha,
    digest,
    sentryRelease: gitSha,
    buildRun: buildRunId,
  });
}

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath} with ${manifest.components.length} components`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `manifest_path=${outputPath}\n`);
}
