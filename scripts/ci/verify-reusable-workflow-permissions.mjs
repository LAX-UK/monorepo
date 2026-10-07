#!/usr/bin/env node
/**
 * Ensures caller jobs grant permissions required by locally referenced reusable workflows.
 * Prevents GitHub startup_failure when a callee job needs actions: write.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const WORKFLOWS_DIR = ".github/workflows";

const PERM_RANK = { read: 1, write: 2, none: 0 };

function permLevel(value) {
  if (value == null || value === "") return PERM_RANK.read;
  const normalized = String(value).toLowerCase();
  return PERM_RANK[normalized] ?? PERM_RANK.read;
}

function mergePermissions(base, overlay) {
  const merged = { ...base };
  if (!overlay) return merged;
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = value;
  }
  return merged;
}

function maxPerm(a, b) {
  return permLevel(a) >= permLevel(b) ? a : b;
}

function calleeRequiredPermissions(doc) {
  const required = {};
  for (const job of Object.values(doc.jobs ?? {})) {
    const jobPerms = job.permissions ?? doc.permissions ?? {};
    for (const [key, value] of Object.entries(jobPerms)) {
      required[key] = maxPerm(required[key], value);
    }
  }
  return required;
}

function loadWorkflow(path) {
  return yaml.load(readFileSync(path, "utf8"));
}

function localReusablePath(uses) {
  if (typeof uses !== "string") return null;
  const match = uses.match(/^\.\/\.github\/workflows\/(.+\.ya?ml)$/);
  return match ? join(WORKFLOWS_DIR, match[1]) : null;
}

const failures = [];

for (const file of readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml"))) {
  const callerPath = join(WORKFLOWS_DIR, file);
  const caller = loadWorkflow(callerPath);
  const workflowPerms = caller.permissions ?? {};

  for (const [jobName, job] of Object.entries(caller.jobs ?? {})) {
    const uses = job.uses;
    const calleePath = localReusablePath(uses);
    if (!calleePath) continue;

    const callee = loadWorkflow(calleePath);
    const required = calleeRequiredPermissions(callee);
    const effective = mergePermissions(workflowPerms, job.permissions);

    for (const [perm, needed] of Object.entries(required)) {
      const have = effective[perm];
      if (permLevel(have) < permLevel(needed)) {
        failures.push(
          `${file} job ${jobName} -> ${calleePath}: needs ${perm}: ${needed}, caller has ${have ?? "(inherit/read)"}`,
        );
      }
    }
  }
}

if (failures.length) {
  for (const line of failures) {
    console.error(`::error::${line}`);
  }
  process.exit(1);
}

console.log("reusable workflow permissions: ok");
