#!/usr/bin/env node
/**
 * Update image tags on selected App Platform components (App Platform starts one deployment).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAppSpec } from "./assert-app-platform-spec.mjs";

const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let appId = "";
  let tagMapJson = "{}";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--tags") tagMapJson = argv[++i] ?? "{}";
  }
  if (!appId) throw new Error("--app-id is required");
  const tagMap = JSON.parse(tagMapJson);
  for (const [name, tag] of Object.entries(tagMap)) {
    if (!SHA.test(tag)) {
      throw new Error(`Tag for ${name} must be a 40-char SHA (got ${tag})`);
    }
  }
  return { appId, tagMap };
}

export function applyTagMapToSpec(spec, tagMap) {
  const next = structuredClone(spec);
  for (const kind of ["services", "workers", "jobs"]) {
    for (const entry of next[kind] ?? []) {
      const desired = tagMap[entry.name];
      if (desired && entry.image) {
        entry.image.tag = desired;
      }
    }
  }
  return next;
}

export function ingressAuthority(rule) {
  const authority = rule.match?.authority;
  if (!authority) return "";
  return authority.exact ?? authority.prefix ?? "";
}

export function ingressPathPrefix(rule) {
  const path = rule.match?.path;
  if (!path) return "";
  return path.prefix ?? path.exact ?? "";
}

/**
 * DO rejects specs with duplicate (authority, path) ingress matches. Live specs can
 * accumulate extra catch-all "/" rules alongside host-scoped domain rules (see
 * auction-infra digitalocean-app module). Drop misrouted and duplicate rules before PUT.
 */
export function sanitizeIngressForDoUpdate(spec) {
  const next = structuredClone(spec);
  const rules = next.ingress?.rules;
  if (!Array.isArray(rules)) return next;

  /** @type {Map<string, string>} */
  const canonicalAuthorityByComponent = new Map();
  for (const rule of rules) {
    const name = rule.component?.name;
    const auth = ingressAuthority(rule);
    const path = ingressPathPrefix(rule);
    if (!name || path !== "/" || !auth) continue;
    if (!canonicalAuthorityByComponent.has(name)) {
      canonicalAuthorityByComponent.set(name, auth);
    }
  }

  let cleaned = rules.filter((rule) => {
    const name = rule.component?.name;
    const auth = ingressAuthority(rule);
    const path = ingressPathPrefix(rule);
    const canonical = name ? canonicalAuthorityByComponent.get(name) : undefined;
    if (canonical && path === "/" && auth !== canonical) {
      return false;
    }
    return true;
  });

  /** @type {Map<string, typeof rules>} */
  const groups = new Map();
  for (const rule of cleaned) {
    const key = `${ingressAuthority(rule)}\0${ingressPathPrefix(rule)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }

  cleaned = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      cleaned.push(group[0]);
      continue;
    }
    const authority = key.split("\0")[0];
    const winners = group.filter(
      (rule) => canonicalAuthorityByComponent.get(rule.component?.name) === authority,
    );
    cleaned.push(winners[0] ?? group[0]);
  }

  next.ingress.rules = cleaned;
  return next;
}

/** @param {string} stdout doctl apps update --output json */
export function deploymentIdFromAppsUpdate(stdout) {
  const payload = JSON.parse(stdout);
  const app = Array.isArray(payload) ? payload[0] : payload;
  const id =
    app?.pending_deployment?.id ?? app?.in_progress_deployment?.id ?? app?.active_deployment?.id;
  if (!id) {
    throw new Error("Missing deployment id from apps update response");
  }
  return id;
}

function main() {
  const { appId, tagMap } = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  const patched = sanitizeIngressForDoUpdate(applyTagMapToSpec(spec, tagMap));
  const dir = mkdtempSync(join(tmpdir(), "do-app-spec-"));
  const specPath = join(dir, "spec.json");
  writeFileSync(specPath, JSON.stringify(patched, null, 2));

  const update = spawnSync(
    "doctl",
    ["apps", "update", appId, "--spec", specPath, "--output", "json"],
    {
      encoding: "utf8",
    },
  );
  if (update.status !== 0) {
    throw new Error(update.stderr || update.stdout || "doctl apps update failed");
  }
  process.stdout.write(`${deploymentIdFromAppsUpdate(update.stdout)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
