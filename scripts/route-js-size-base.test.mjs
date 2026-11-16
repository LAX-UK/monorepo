import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { main, planBase, touchesSizeBuild } from "./route-js-size-base.mjs";

let dir;
before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "route-js-base-"));
});
after(() => rmSync(dir, { recursive: true, force: true }));

const names = { "apps/web": "@auction/web", "apps/shop": "@auction/shop", "apps/new": "@x/new" };

test("plan: the base builds the head's apps that exist at the base, with turbo filters", () => {
  const plan = planBase({
    headApps: ["apps/web", "apps/new", "apps/shop"],
    exists: (app) => app !== "apps/new",
    packageName: (app) => names[app],
  });
  assert.deepEqual(plan, {
    apps: "apps/web apps/shop",
    filters: "--filter=@auction/web --filter=@auction/shop",
    key: "apps-web+apps-shop",
    head_apps: "apps/web apps/new apps/shop",
    head_filters: "--filter=@auction/web --filter=@x/new --filter=@auction/shop",
    self_check: "false",
  });
});

test("plan: no app in common gives empty outputs, so the CI steps skip", () => {
  const plan = planBase({ headApps: [], exists: () => true, packageName: () => "x" });
  assert.equal(plan.apps, "");
  assert.equal(plan.filters, "");
  assert.equal(plan.self_check, "false");
});

test("the self-check runs when a PR changes what a size build depends on", () => {
  for (const file of [
    ".github/workflows/ci.yml",
    "turbo.json",
    "package.json",
    "pnpm-lock.yaml",
    ".nvmrc",
    "scripts/route-js-size-report.mjs",
    "scripts/route-js-size-build-base.sh",
    "apps/web/next.config.ts",
    "apps/shop-admin/next.config.mjs",
    "packages/observability/src/next-size-build.ts",
  ]) {
    assert.equal(touchesSizeBuild(file), true, file);
  }
  for (const file of [
    "apps/web/src/app/page.tsx",
    "apps/web/package.json",
    "docs/engineering/route-js-budgets.md",
    "scripts/check-brand-name.mjs",
    ".github/workflows/web-pr.yml",
    "packages/observability/src/next-size-build.test.ts",
  ]) {
    assert.equal(touchesSizeBuild(file), false, file);
  }
  const plan = planBase({
    headApps: ["apps/web"],
    exists: () => true,
    packageName: (app) => names[app],
    changedFiles: ["apps/web/src/a.tsx", "turbo.json"],
  });
  assert.equal(plan.self_check, "true");
});

test("plan CLI: writes GITHUB_OUTPUT, and a bad head report is exit 2", () => {
  const head = path.join(dir, "head.json");
  const out = path.join(dir, "output.txt");
  // apps/web exists at HEAD of this repository, so the real git and package.json lookups work.
  writeFileSync(head, JSON.stringify({ version: 1, apps: { "apps/web": {} } }));
  writeFileSync(out, "");
  const logs = [];
  const env = { GITHUB_OUTPUT: out };
  assert.equal(
    main(["plan", "--head-report", head, "--base", "HEAD"], { env, log: (l) => logs.push(l) }),
    0,
  );
  const written = readFileSync(out, "utf8");
  assert.match(written, /^apps=apps\/web$/m);
  assert.match(written, /^filters=--filter=\S+$/m);
  assert.match(written, /^self_check=false$/m);
  writeFileSync(head, "{");
  assert.equal(
    main(["plan", "--head-report", head, "--base", "HEAD"], { env: {}, log: () => {} }),
    2,
  );
  assert.equal(main(["plan", "--base", "HEAD"], { env: {}, log: () => {} }), 2);
  assert.equal(main(["nope"], { env: {}, log: () => {} }), 2);
});

test("missing-base: warns for every PR and fails motion or performance work", () => {
  const logs = [];
  const run = (argv, env) => {
    logs.length = 0;
    return main(["missing-base", ...argv], { env, log: (l) => logs.push(l) });
  };
  assert.equal(run([], { PR_TITLE: "Shop: basket copy", PR_LABELS: "[]" }), 0);
  assert.match(logs[0], /^::warning title=Route JS vs base::The base could not be built/);
  assert.equal(run([], { PR_TITLE: "Overlay motion", PR_LABELS: "[]" }), 1);
  assert.match(logs.at(-1), /counts as motion or performance work \(title mentions "motion"\)/);
  assert.equal(run([], { PR_TITLE: "x", PR_LABELS: '["perf"]' }), 1);
  const changed = path.join(dir, "changed.txt");
  writeFileSync(changed, "packages/ui/src/lax/motion.css\n");
  assert.equal(run(["--changed-files", changed], { PR_TITLE: "x" }), 1);
  // Malformed labels are bad input, not a stack trace.
  assert.equal(run([], { PR_TITLE: "x", PR_LABELS: "[oops" }), 2);
});
