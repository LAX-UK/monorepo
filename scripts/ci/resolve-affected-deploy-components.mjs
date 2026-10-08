#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { readAppSpec } from "./assert-app-platform-spec.mjs";
import { DEPLOY_COMPONENTS, componentsForChangedPaths } from "./deploy-component-paths.mjs";
import {
  buildDeployTagMap,
  filterAffectedForDeploy,
  filterBuildComponents,
} from "./deploy-tag-map.mjs";

const SHA = /^[0-9a-f]{40}$/;

export function readComponentImageTags(spec) {
  /** @type {Record<string, string>} */
  const tags = {};
  for (const kind of ["services", "workers", "jobs"]) {
    for (const entry of spec?.[kind] ?? []) {
      const name = entry?.name;
      const tag = entry?.image?.tag?.trim();
      if (name && tag) tags[name] = tag;
    }
  }
  return tags;
}

function gitExists(ref) {
  const result = spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], { encoding: "utf8" });
  return result.status === 0;
}

function gitDiffPaths(baseSha, headSha) {
  const result = spawnSync("git", ["diff", "--name-only", `${baseSha}..${headSha}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git diff failed");
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function resolveAffectedComponents({ targetSha, liveTags }) {
  if (!SHA.test(targetSha)) {
    throw new Error("targetSha must be a 40-character git SHA");
  }
  const affected = new Set();
  /** @type {Map<string, string[]>} */
  const byLiveSha = new Map();
  for (const component of DEPLOY_COMPONENTS) {
    const live = liveTags[component] ?? "";
    if (!SHA.test(live) || !gitExists(live)) {
      affected.add(component);
      continue;
    }
    const list = byLiveSha.get(live) ?? [];
    list.push(component);
    byLiveSha.set(live, list);
  }
  for (const [liveSha, components] of byLiveSha) {
    if (liveSha === targetSha) continue;
    const paths = gitDiffPaths(liveSha, targetSha);
    const pathHits = new Set(componentsForChangedPaths(paths));
    for (const component of components) {
      if (pathHits.has(component)) {
        affected.add(component);
      }
    }
  }
  return filterAffectedForDeploy([...affected].sort());
}

export function resolveBuildComponents(affected) {
  const builds = new Set(affected.filter((name) => name !== "migrate"));
  if (builds.size > 0) {
    builds.add("migrate");
  }
  return filterBuildComponents([...builds].sort());
}

function main() {
  const appId = process.env.APP_ID;
  const targetSha = process.env.TARGET_SHA ?? process.env.GITHUB_SHA;
  if (!appId || !targetSha) {
    throw new Error("Set APP_ID and TARGET_SHA (or GITHUB_SHA)");
  }
  const spec = readAppSpec(appId);
  const liveTags = readComponentImageTags(spec);
  const affected = resolveAffectedComponents({ targetSha, liveTags });
  const buildComponents = resolveBuildComponents(affected);
  const tagMap = buildDeployTagMap({ liveTags, affected, targetSha });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${affected.length > 0 ? "true" : "false"}\n`);
  }
  if (affected.length === 0) {
    process.stdout.write(
      `${JSON.stringify({ affected_components: [], build_components: [], deploy: false, tag_map: tagMap }, null, 2)}\n`,
    );
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, "affected_components=[]\n");
      appendFileSync(process.env.GITHUB_OUTPUT, "build_components=[]\n");
      appendFileSync(process.env.GITHUB_OUTPUT, `tag_map=${JSON.stringify(tagMap)}\n`);
    }
    return;
  }

  const payload = {
    target_sha: targetSha,
    live_tags: liveTags,
    affected_components: affected,
    build_components: buildComponents,
    tag_map: tagMap,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `affected_components=${JSON.stringify(affected)}\n`);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `build_components=${JSON.stringify(buildComponents)}\n`,
    );
    appendFileSync(process.env.GITHUB_OUTPUT, `tag_map=${JSON.stringify(tagMap)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
