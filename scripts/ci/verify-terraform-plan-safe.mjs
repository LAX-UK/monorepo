#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const planPath = process.argv[2];
if (!planPath) {
  throw new Error("Usage: node scripts/ci/verify-terraform-plan-safe.mjs <plan-binary>");
}

const result = spawnSync("terraform", ["show", "-json", planPath], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
  stdio: ["ignore", "pipe", "inherit"],
});
if (result.status !== 0 || !result.stdout) {
  throw new Error("terraform show -json failed");
}

const plan = JSON.parse(result.stdout);
const changes = plan.resource_changes ?? [];
const blocked = [];
const allowedDeleteAddresses = parseAllowedDeleteAddresses(
  process.env.TF_ALLOWED_DELETE_ADDRESSES ?? "[]",
);

for (const change of changes) {
  const actions = change.change?.actions ?? [];
  if (actions.includes("create") && actions.includes("delete")) {
    blocked.push(`${change.address}: replace`);
  } else if (actions.includes("delete") && !allowedDeleteAddresses.has(change.address)) {
    blocked.push(`${change.address}: delete`);
  }
}

if (blocked.length > 0) {
  throw new Error(
    `Terraform plan contains blocked deletions or replacements:\n${blocked.map((line) => `- ${line}`).join("\n")}`,
  );
}

console.log(
  `Terraform plan contains no blocked deletions or replacements (${allowedDeleteAddresses.size} exact deletion exceptions configured)`,
);

function parseAllowedDeleteAddresses(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TF_ALLOWED_DELETE_ADDRESSES must be a JSON array");
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new Error("TF_ALLOWED_DELETE_ADDRESSES must be a JSON array of resource addresses");
  }
  return new Set(parsed);
}
