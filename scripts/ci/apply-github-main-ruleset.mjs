#!/usr/bin/env node
/**
 * Applies scripts/ci/github-main-ruleset.json via GitHub API.
 * Requires repo admin. Run after merge_group workflows are on main.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const payload = JSON.parse(
  readFileSync(join(repoRoot, "scripts/ci/github-main-ruleset.json"), "utf8"),
);

function ghApi(method, path, body) {
  const args = ["api", "-X", method, path];
  if (body !== undefined) {
    args.push("--input", "-");
  }
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

const existing = JSON.parse(ghApi("GET", "repos/LAX-UK/monorepo/rulesets"));
const prior = existing.find((r) => r.name === payload.name && r.target === "branch");
if (prior) {
  ghApi("PUT", `repos/LAX-UK/monorepo/rulesets/${prior.id}`, payload);
  console.log(`Updated ruleset ${prior.id} (${payload.name}).`);
} else {
  ghApi("POST", "repos/LAX-UK/monorepo/rulesets", payload);
  console.log(`Created ruleset ${payload.name}.`);
}

const del = spawnSync(
  "gh",
  ["api", "-X", "DELETE", "repos/LAX-UK/monorepo/branches/main/protection"],
  {
    encoding: "utf8",
  },
);
if (del.status === 0) {
  console.log("Removed classic branch protection on main.");
} else {
  console.warn("Classic branch protection not removed:", del.stderr?.trim() || del.stdout?.trim());
}

ghApi("PATCH", "repos/LAX-UK/monorepo", {
  delete_branch_on_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  allow_squash_merge: true,
});
console.log("Repository merge options: squash-only, delete branch on merge.");
