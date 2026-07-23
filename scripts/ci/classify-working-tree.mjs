#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Summarize dirty working tree for release review (does not modify git state).
 */
import { basename, dirname } from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const RELEASE_SLICES = [
  {
    id: "runtime-packages",
    label: "Runtime packages (must ship together)",
    prefixes: [
      "packages/bidding-runtime/",
      "packages/background-runtime/",
      "packages/lot-lifecycle-app/",
      "packages/finance-runtime/",
      "packages/finance-cron-app/",
    ],
  },
  {
    id: "persistence-db-queues",
    label: "Persistence / DB / queues",
    prefixes: [
      "packages/persistence/",
      "packages/db/",
      "packages/queues/",
      "packages/domain/",
      "packages/exports/",
    ],
  },
  {
    id: "worker",
    label: "Worker runtime",
    prefixes: ["apps/worker/"],
  },
  {
    id: "api-runtime-extraction",
    label: "API bid/lifecycle/finance extraction",
    prefixes: [
      "apps/api/src/services/bid/",
      "apps/api/src/services/cron/",
      "apps/api/src/exports/",
      "apps/api/src/container/create-bidding",
      "apps/api/src/container/create-lot-lifecycle",
      "apps/api/src/container/create-cron",
    ],
  },
  {
    id: "api-dip-container",
    label: "API route ports + container DIP",
    prefixes: [
      "apps/api/src/container/",
      "apps/api/src/routes/",
      "apps/api/src/lib/",
      "apps/api/scripts/check-",
      "apps/api/src/services/interfaces/",
      "apps/api/src/services/admin/",
      "apps/api/src/services/catalog/",
      "apps/api/src/services/compliance/",
      "apps/api/src/services/finance/",
      "apps/api/src/services/platform/",
      "apps/api/src/services/bidding/",
      "apps/api/src/services/lot-lifecycle/",
    ],
  },
  {
    id: "web",
    label: "Web admin / buyer",
    prefixes: ["apps/web/"],
  },
  {
    id: "ci-guardrails",
    label: "CI / scripts / env / runbooks",
    prefixes: [
      ".github/",
      "scripts/",
      ".env.example",
      "docs/runbooks/",
      "docs/architecture/",
      "package.json",
      "pnpm-lock.yaml",
      "turbo.json",
    ],
  },
];

const UNTRACKED_PACKAGE_ROOTS = [
  "packages/bidding-runtime",
  "packages/background-runtime",
  "packages/lot-lifecycle-app",
  "packages/finance-runtime",
  "packages/finance-cron-app",
];

function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return r.stdout.trim();
}

function bucketPath(path) {
  for (const slice of RELEASE_SLICES) {
    if (slice.prefixes.some((p) => path.startsWith(p))) return slice.id;
  }
  if (path.startsWith("packages/")) return "packages-other";
  if (path.startsWith("apps/api/")) return "api-other";
  return "other";
}

function stemForDeletionMatch(path) {
  const base = basename(path);
  return base.replace(/\.(ts|tsx|js|mjs)$/, "");
}

const porcelain = git(["status", "--porcelain=v1"]);
const lines = porcelain ? porcelain.split("\n") : [];

const buckets = {
  modified: [],
  added: [],
  deleted: [],
  untracked: [],
  renamed: [],
  other: [],
};

for (const line of lines) {
  const code = line.slice(0, 2);
  const path = line.slice(3).replace(/^.* -> /, "");
  if (code === "??") buckets.untracked.push(path);
  else if (code.includes("D")) buckets.deleted.push(path);
  else if (code.includes("A")) buckets.added.push(path);
  else if (code.includes("R")) buckets.renamed.push(path);
  else if (code.includes("M") || code.includes("T")) buckets.modified.push(path);
  else buckets.other.push(line);
}

const allDirty = [
  ...buckets.modified,
  ...buckets.added,
  ...buckets.deleted,
  ...buckets.untracked,
  ...buckets.renamed,
];

const sliceCounts = Object.fromEntries(RELEASE_SLICES.map((s) => [s.id, 0]));
sliceCounts["packages-other"] = 0;
sliceCounts["api-other"] = 0;
sliceCounts.other = 0;

for (const p of allDirty) {
  const id = bucketPath(p);
  sliceCounts[id] = (sliceCounts[id] ?? 0) + 1;
}

console.log("Working tree classification (release review)\n");
for (const [name, items] of Object.entries(buckets)) {
  console.log(`${name}: ${items.length}`);
}
console.log(`\ntotal paths: ${lines.length}`);

console.log("\nRelease slices (path counts):");
for (const slice of RELEASE_SLICES) {
  console.log(`  ${slice.id}: ${sliceCounts[slice.id] ?? 0} — ${slice.label}`);
}
console.log(`  packages-other: ${sliceCounts["packages-other"]}`);
console.log(`  api-other: ${sliceCounts["api-other"]}`);
console.log(`  other: ${sliceCounts.other}`);

console.log("\nUntracked runtime package roots:");
for (const root of UNTRACKED_PACKAGE_ROOTS) {
  const hasAny = buckets.untracked.some((p) => p === root || p.startsWith(`${root}/`));
  const marker = hasAny ? "MISSING FROM INDEX" : "ok (tracked or absent)";
  console.log(`  ${root}: ${marker}`);
}

const deletedStems = new Map();
for (const p of buckets.deleted) {
  deletedStems.set(stemForDeletionMatch(p), p);
}
const unmatchedDeletions = [];
for (const [stem, delPath] of deletedStems) {
  const replacement = allDirty.find(
    (p) => p !== delPath && !buckets.deleted.includes(p) && basename(p).includes(stem),
  );
  if (!replacement) unmatchedDeletions.push(delPath);
}

console.log(
  `\nDeletion review: ${buckets.deleted.length} deleted, ${unmatchedDeletions.length} without obvious replacement basename`,
);
const preview = (label, items, limit = 12) => {
  if (items.length === 0) return;
  console.log(`\n${label} (first ${Math.min(limit, items.length)}):`);
  for (const p of items.slice(0, limit)) console.log(`  ${p}`);
  if (items.length > limit) console.log(`  ... +${items.length - limit} more`);
};
preview("unmatched deletions (review before PR)", unmatchedDeletions, 20);

console.log(
  "\nNext: run `pnpm ci:backup-ref`, stage one slice at a time, never `git add -A` on the full tree.",
);
