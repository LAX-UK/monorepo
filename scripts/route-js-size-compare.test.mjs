import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  main as compareMain,
  compareReports,
  isMotionSource,
  noGrowthReason,
  parseLabels,
  renderMarkdown,
} from "./route-js-size-compare.mjs";
import { appReport, sizeApps, sizeReport } from "./route-js-size-report.mjs";

// A build in the shape Next 15 writes (see check-route-js-budget.test.mjs).
const APP_MANIFEST = {
  pages: {
    "/layout": ["static/chunks/webpack-aaa.js", "static/chunks/app/layout-fff.js"],
    "/(marketing)/page": ["static/chunks/webpack-aaa.js", "static/chunks/app/page-ccc.js"],
    "/about/page": ["static/chunks/webpack-aaa.js", "static/chunks/app/about-ddd.js"],
    "/admin/staff/page": ["static/chunks/app/admin-eee.js"],
  },
};
const BUILD_MANIFEST = { rootMainFiles: ["static/chunks/webpack-aaa.js"] };
const APP_CONFIG = { fallback: "public", ignore: ["^/admin"], groups: { public: { match: [] } } };

const chunk = (bytes, seed = 7) => {
  let out = "";
  let s = seed;
  while (out.length < bytes) {
    s = (s * 1103515245 + 12345) % 2147483648;
    out += s.toString(36);
  }
  return out.slice(0, bytes);
};

let root;
function writeBuild(dir, { pageBytes = 4096, aboutSeed = 3 } = {}) {
  const next = path.join(dir, ".next");
  mkdirSync(path.join(next, "static/chunks/app"), { recursive: true });
  writeFileSync(path.join(next, "app-build-manifest.json"), JSON.stringify(APP_MANIFEST));
  writeFileSync(path.join(next, "build-manifest.json"), JSON.stringify(BUILD_MANIFEST));
  writeFileSync(path.join(next, "static/chunks/webpack-aaa.js"), chunk(2048));
  writeFileSync(path.join(next, "static/chunks/app/layout-fff.js"), chunk(3072, 11));
  writeFileSync(path.join(next, "static/chunks/app/page-ccc.js"), chunk(pageBytes, 5));
  writeFileSync(path.join(next, "static/chunks/app/about-ddd.js"), chunk(1024, aboutSeed));
  writeFileSync(path.join(next, "static/chunks/app/admin-eee.js"), chunk(9000, 13));
  return next;
}

before(() => {
  root = mkdtempSync(path.join(tmpdir(), "route-js-size-"));
});
after(() => rmSync(root, { recursive: true, force: true }));

test("the report measures each page route in exact gzip bytes and skips ignored routes", () => {
  const next = writeBuild(path.join(root, "one"));
  const entry = appReport({ nextDir: next, appConfig: APP_CONFIG });
  assert.deepEqual(Object.keys(entry.routes), ["/(marketing)/page", "/about/page"]);
  const home = entry.routes["/(marketing)/page"];
  assert.equal(home.files, 3);
  assert.ok(Number.isInteger(home.gzipBytes) && home.gzipBytes > 0);
  assert.equal(home.rawBytes, 2048 + 3072 + 4096);
  assert.equal(entry.clientScripts, 5);
  assert.match(entry.clientDigest, /^[0-9a-f]{64}$/);
  // An app without a budget entry reports every page route.
  assert.equal(Object.keys(appReport({ nextDir: next }).routes).length, 3);
});

test("two identical builds give identical reports and digests", () => {
  const a = appReport({ nextDir: writeBuild(path.join(root, "a")), appConfig: APP_CONFIG });
  const b = appReport({ nextDir: writeBuild(path.join(root, "b")), appConfig: APP_CONFIG });
  assert.deepEqual(a, b);
});

test("a changed script changes the digest even when no route changes size", () => {
  const a = appReport({ nextDir: writeBuild(path.join(root, "c")), appConfig: APP_CONFIG });
  const b = appReport({
    nextDir: writeBuild(path.join(root, "d"), { aboutSeed: 3 }),
    appConfig: APP_CONFIG,
  });
  writeFileSync(path.join(root, "d/.next/static/chunks/app/admin-eee.js"), chunk(9000, 17));
  const changed = appReport({ nextDir: path.join(root, "d/.next"), appConfig: APP_CONFIG });
  assert.equal(a.clientDigest, b.clientDigest);
  assert.notEqual(a.clientDigest, changed.clientDigest);
  assert.deepEqual(a.routes, changed.routes);
});

test("the report covers the budgeted apps then Shop Admin, and leaves out apps with no build", () => {
  const config = { apps: { "apps/one": APP_CONFIG, "apps/none": APP_CONFIG } };
  assert.deepEqual(sizeApps(config), ["apps/one", "apps/none", "apps/shop-admin"]);
  writeBuild(path.join(root, "apps/one"));
  const report = sizeReport({ root, apps: sizeApps(config), config, label: "abc" });
  assert.deepEqual(Object.keys(report.apps), ["apps/one"]);
  assert.equal(report.label, "abc");
  assert.equal(report.version, 1);
});

const report = (routes, digest = "d") => ({
  version: 1,
  label: "x",
  apps: { "apps/web": { routes, clientScripts: 1, clientDigest: digest } },
});
const r = (gzipBytes) => ({ gzipBytes, rawBytes: gzipBytes * 3, files: 1 });

test("identical reports have no changed rows and no growth", () => {
  const base = report({ "/a/page": r(1000), "/b/page": r(2000) });
  const result = compareReports(base, structuredClone(base));
  assert.equal(result.apps[0].changed.length, 0);
  assert.equal(result.apps[0].unchanged, 2);
  assert.equal(result.apps[0].identical, true);
  assert.deepEqual(result.grown, []);
});

test("one byte of growth is growth; shrinking, new and removed routes are listed apart", () => {
  const base = report({ "/a/page": r(1000), "/b/page": r(2000), "/gone/page": r(10) });
  const head = report({ "/a/page": r(1001), "/b/page": r(1990), "/new/page": r(50) }, "e");
  const result = compareReports(base, head);
  const byRoute = Object.fromEntries(result.apps[0].changed.map((row) => [row.route, row]));
  assert.equal(byRoute["/a/page"].deltaBytes, 1);
  assert.equal(byRoute["/b/page"].deltaBytes, -10);
  assert.equal(byRoute["/new/page"].baseBytes, null);
  assert.equal(byRoute["/gone/page"].headBytes, null);
  assert.deepEqual(
    result.grown.map((row) => row.route),
    ["/a/page"],
  );
  assert.deepEqual(
    result.added.map((row) => row.route),
    ["/new/page"],
  );
  assert.equal(result.changedCount, 4);
  const markdown = renderMarkdown(result, { base, head, reason: null });
  assert.match(markdown, /\| `\/a\/page` \| 0\.98 \| 0\.98 \| \+0\.00 \| \+1 \|/);
  assert.match(markdown, /\| `\/new\/page` \| new \|/);
  assert.match(markdown, /\| `\/gone\/page` \| 0\.01 \| removed \|/);
  assert.match(markdown, /1 route\(s\) grew and 1 route\(s\) are new\. Reported only/);
});

test("apps built on one side only are not compared", () => {
  const base = report({ "/a/page": r(1) });
  const head = { ...report({ "/a/page": r(1) }) };
  head.apps = { "apps/shop": head.apps["apps/web"] };
  const result = compareReports(base, head);
  assert.deepEqual(result.apps, []);
  assert.deepEqual(result.onlyBase, ["apps/web"]);
  assert.deepEqual(result.onlyHead, ["apps/shop"]);
});

test("motion and performance PRs are recognised by label or title word", () => {
  assert.equal(noGrowthReason({ title: "Shop: basket copy", labels: ["ui"] }), null);
  assert.equal(noGrowthReason({ title: "Perfect the basket", labels: [] }), null);
  assert.match(noGrowthReason({ title: "Overlay motion (MO3)", labels: [] }), /title/);
  assert.match(noGrowthReason({ title: "Perf: lazy socket", labels: [] }), /perf/i);
  assert.match(noGrowthReason({ title: "x", labels: ["performance"] }), /labelled "performance"/);
  assert.deepEqual(parseLabels('[{"name":"motion"},{"name":"ui"}]'), ["motion", "ui"]);
  assert.deepEqual(parseLabels('["perf"]'), ["perf"]);
  assert.deepEqual(parseLabels("motion, ui"), ["motion", "ui"]);
  assert.deepEqual(parseLabels(""), []);
  assert.throws(() => parseLabels("[not json"), /not valid JSON/);
  assert.throws(() => parseLabels("[1"), /not valid JSON/);
});

test("a changed motion source file makes a PR motion work, whatever its title or labels", () => {
  assert.equal(isMotionSource("packages/ui/src/lax/motion.css"), true);
  assert.equal(isMotionSource("packages/marketing-ui/src/motion/reveal/reveal.tsx"), true);
  assert.equal(isMotionSource("apps/web/src/lib/cover-motion.ts"), true);
  assert.equal(isMotionSource("packages/ui/src/lax/motion.test.ts"), false);
  assert.equal(isMotionSource("packages/ui/src/test/motion-css.ts"), false);
  assert.equal(isMotionSource("docs/design/motion.md"), false);
  assert.equal(isMotionSource("packages/ui/src/lax/button.tsx"), false);
  const reason = noGrowthReason({
    title: "Shop: basket copy",
    labels: [],
    changedFiles: ["docs/design/motion.md", "packages/ui/src/lax/motion.css"],
  });
  assert.equal(reason, "changes motion source `packages/ui/src/lax/motion.css`");
  assert.equal(noGrowthReason({ title: "Docs", changedFiles: ["docs/design/motion.md"] }), null);
});

test("the summary sentence reads as a sentence for every kind of reason", () => {
  const base = report({ "/a/page": r(1000) });
  const result = compareReports(base, structuredClone(base));
  const markdown = renderMarkdown(result, { base, head: base, reason: 'title mentions "Motion"' });
  assert.match(
    markdown,
    /This PR counts as motion or performance work \(title mentions "Motion"\), so any growth or new route would fail this step\./,
  );
  assert.doesNotMatch(markdown, /PR is title/);
});

test("main: growth fails a motion PR, is reported for others, and bad input is exit 2", () => {
  const dir = path.join(root, "main");
  mkdirSync(dir, { recursive: true });
  const basePath = path.join(dir, "base.json");
  const headPath = path.join(dir, "head.json");
  const summary = path.join(dir, "summary.md");
  writeFileSync(basePath, JSON.stringify(report({ "/a/page": r(1000) })));
  writeFileSync(headPath, JSON.stringify(report({ "/a/page": r(1001) })));
  const logs = [];
  const run = (argv, env = {}) => {
    logs.length = 0;
    return compareMain(argv, { env, log: (line) => logs.push(line) });
  };
  const args = ["--base", basePath, "--head", headPath];
  assert.equal(run(args, { PR_TITLE: "Docs tweak", GITHUB_STEP_SUMMARY: summary }), 0);
  assert.match(
    logs.at(-1),
    /^::notice title=Route JS vs base::apps\/web \/a\/page grew by 1 bytes/,
  );
  assert.match(readFileSync(summary, "utf8"), /### Route JS: base vs head/);
  assert.equal(run(args, { PR_TITLE: "Docs tweak", PR_LABELS: '["motion"]' }), 1);
  assert.match(logs.at(-1), /^error: apps\/web \/a\/page grew by 1 bytes/);
  assert.equal(run([...args, "--title", "Card motion"]), 1);
  // No growth: a motion PR passes.
  assert.equal(run(["--base", basePath, "--head", basePath, "--title", "Card motion"]), 0);
  assert.equal(run(["--base", basePath]), 2);
  // Malformed labels are bad input (exit 2), not a crash.
  assert.equal(run(args, { PR_TITLE: "Docs tweak", PR_LABELS: "[oops" }), 2);
  // A changed motion source file turns the check on without a label or title word.
  const changed = path.join(dir, "changed.txt");
  writeFileSync(changed, "packages/ui/src/lax/motion.css\n");
  assert.equal(run([...args, "--changed-files", changed], { PR_TITLE: "Docs tweak" }), 1);
  assert.equal(run([...args, "--changed-files", path.join(dir, "missing.txt")]), 2);
  writeFileSync(headPath, JSON.stringify({ version: 99, apps: {} }));
  assert.equal(run(args), 2);
});

test("main: a new route fails a motion PR and is a notice for others", () => {
  const dir = path.join(root, "new-route");
  mkdirSync(dir, { recursive: true });
  const basePath = path.join(dir, "base.json");
  const headPath = path.join(dir, "head.json");
  writeFileSync(basePath, JSON.stringify(report({ "/a/page": r(1000) })));
  writeFileSync(headPath, JSON.stringify(report({ "/a/page": r(1000), "/b/page": r(10) })));
  const logs = [];
  const run = (argv, env = {}) => {
    logs.length = 0;
    return compareMain(argv, { env, log: (line) => logs.push(line) });
  };
  const args = ["--base", basePath, "--head", headPath];
  assert.equal(run(args, { PR_TITLE: "Docs tweak" }), 0);
  assert.match(logs.at(-1), /^::notice title=Route JS vs base::apps\/web \/b\/page is a new route/);
  assert.equal(run(args, { PR_TITLE: "Card motion" }), 1);
  assert.match(logs.at(-1), /^error: apps\/web \/b\/page is a new route/);
  // Removing a route is never growth.
  assert.equal(run(["--base", headPath, "--head", basePath], { PR_TITLE: "Card motion" }), 0);
});

test("main --require-unchanged: the self-check passes only when the two builds are the same", () => {
  const dir = path.join(root, "self-check");
  mkdirSync(dir, { recursive: true });
  const a = path.join(dir, "a.json");
  const b = path.join(dir, "b.json");
  const c = path.join(dir, "c.json");
  const d = path.join(dir, "d.json");
  writeFileSync(a, JSON.stringify(report({ "/a/page": r(1000) })));
  // Same sizes, different client scripts: the build is not deterministic, so it fails.
  writeFileSync(b, JSON.stringify(report({ "/a/page": r(1000) }, "other")));
  writeFileSync(c, JSON.stringify(report({ "/a/page": r(999) })));
  const onlyShop = report({ "/a/page": r(1000) });
  onlyShop.apps = { "apps/shop": onlyShop.apps["apps/web"] };
  writeFileSync(d, JSON.stringify(onlyShop));
  const logs = [];
  const run = (argv) => {
    logs.length = 0;
    return compareMain([...argv, "--require-unchanged", "--heading", "Self"], {
      env: { PR_TITLE: "Docs" },
      log: (line) => logs.push(line),
    });
  };
  assert.equal(run(["--base", a, "--head", a]), 0);
  assert.match(logs[0], /^### Self/);
  assert.match(logs[0], /0 of 1 routes changed \(client scripts byte-identical\)/);
  assert.match(logs[0], /Self-check passed/);
  assert.equal(run(["--base", a, "--head", b]), 1);
  assert.match(logs[0], /0 of 1 routes changed \(client scripts differ\)/);
  assert.match(logs[0], /Self-check failed.*not trusted/);
  assert.match(logs.at(-1), /^error: apps\/web client scripts differ between two builds/);
  // Shrinking is a failure too: the two builds must be the same.
  assert.equal(run(["--base", a, "--head", c]), 1);
  assert.match(logs.at(-1), /^error: apps\/web \/a\/page differs between two builds/);
  assert.equal(run(["--base", a, "--head", d]), 1);
});
