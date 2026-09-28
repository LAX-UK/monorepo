#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Detect in-flight staging deploy/terraform workflows (main branch).
 * Writes `active=true|false` to GITHUB_OUTPUT when set.
 */
import { appendFileSync } from "node:fs";

const repository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
const workflows = [
  "terraform-test-up.yml",
  "terraform-apply-test.yml",
  "staging-recovery-test.yml",
  "app-deploy-test.yml",
  "identity-staging-deploy.yml",
  "identity-directory-maintenance-test.yml",
  "identity-migration-maintenance-test.yml",
  "identity-role-maintenance-test.yml",
  "auth-at-rest-maintenance-test.yml",
  "identity-staging-db-repair.yml",
];

function ghJson(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "gh failed");
  }
  return JSON.parse(result.stdout);
}

function main() {
  let active = false;
  for (const workflow of workflows) {
    const runs = ghJson([
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      workflow,
      "--branch",
      "main",
      "--limit",
      "5",
      "--json",
      "status,conclusion",
    ]);
    if (
      runs.some(
        (run) =>
          run.status === "in_progress" || run.status === "queued" || run.status === "pending",
      )
    ) {
      active = true;
      break;
    }
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `active=${active}\n`);
  }
  console.log(`staging_maintenance_active=${active}`);
}

main();
