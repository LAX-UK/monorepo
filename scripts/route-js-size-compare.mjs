#!/usr/bin/env node
/**
 * Base-versus-head route JavaScript table for a pull request. Reads two reports written by
 * `route-js-size-report.mjs` (the PR's base commit and the PR, both built with the deterministic
 * size-build settings) and prints, per app, every route whose start-up JavaScript changed, in exact
 * gzip bytes. Identical builds give an empty table, so any number in it is a real change.
 *
 * It adds no rule of its own to the budget check. For most pull requests it only reports. For
 * motion or performance work (a label or a title word matching `NO_GROWTH_PATTERN`, or a changed
 * motion source file matching `isMotionSource`) any growth of an existing route, and any new route,
 * fails, because those changes promise no route JavaScript growth (`docs/design/motion.md`); there
 * is no allowance.
 *
 * Usage: node scripts/route-js-size-compare.mjs --base <base.json> --head <head.json>
 *                                               [--title <pr title>] [--labels <a,b>]
 *                                               [--changed-files <file>] [--heading <text>]
 *                                               [--require-unchanged]
 *   --title, --labels   the pull request's title and labels; default PR_TITLE and PR_LABELS
 *                       (labels as a JSON array or comma-separated)
 *   --changed-files     a file listing the paths the PR changes, one per line
 *   --heading           the table heading (default "Route JS: base vs head")
 *   --require-unchanged the CI self-check: both reports come from the same commit, so any changed,
 *                       new or removed route, any app whose client scripts differ, or an app
 *                       built on one side only, fails
 *
 * Exit codes: 0 reported, 1 a motion or performance PR grew a route (or, with
 * --require-unchanged, the two builds differ), 2 bad usage or reports.
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_VERSION } from "./route-js-size-report.mjs";

/** A label or a title word that marks motion or performance work. */
export const NO_GROWTH_PATTERN = /\b(motion|perf|performance)\b/i;

/**
 * A changed file that is motion source: shipped code or styles under apps/ or packages/ with
 * "motion" in a directory or file name (for example `packages/ui/src/lax/motion.css` or
 * `packages/marketing-ui/src/motion/`). Tests and docs do not count. This keeps the check on when a
 * motion PR is renamed or loses its label.
 */
export function isMotionSource(file) {
  const name = String(file).trim();
  if (!/^(apps|packages)\//.test(name)) return false;
  if (!/\.(c|m)?(j|t)sx?$|\.css$/.test(name)) return false;
  if (/\.(test|spec)\.|(^|\/)(test|tests|__tests__)\//.test(name)) return false;
  return name.split("/").some((part) => /motion/i.test(part));
}

export class UsageError extends Error {}

export function parseArgs(argv, env = {}) {
  const args = {
    base: null,
    head: null,
    title: env.PR_TITLE ?? "",
    labels: env.PR_LABELS ?? "",
    changedFiles: null,
    heading: "Route JS: base vs head",
    requireUnchanged: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new UsageError(`${arg} needs a value`);
      return next;
    };
    if (arg === "--base") args.base = value();
    else if (arg === "--head") args.head = value();
    else if (arg === "--title") args.title = value();
    else if (arg === "--labels") args.labels = value();
    else if (arg === "--changed-files") args.changedFiles = value();
    else if (arg === "--heading") args.heading = value();
    else if (arg === "--require-unchanged") args.requireUnchanged = true;
    else throw new UsageError(`unknown option ${arg}`);
  }
  if (!args.base || !args.head) throw new UsageError("--base and --head are required");
  return args;
}

/**
 * Labels as given by the workflow: a JSON array of names, or a comma-separated list. Malformed
 * JSON is a `UsageError` (exit 2), not a crash.
 */
export function parseLabels(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new UsageError(`PR labels are not valid JSON: ${error.message}`);
    }
    if (!Array.isArray(parsed)) throw new UsageError("PR labels must be a JSON array");
    return parsed.map((label) => (typeof label === "string" ? label : label?.name)).filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

/** Changed paths from a file with one path per line (blank lines ignored). */
export function readChangedFiles(file) {
  if (!file) return [];
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    throw new UsageError(`cannot read changed files: ${error.message}`);
  }
}

/**
 * Why this PR counts as motion or performance work and may not grow any route (`null` when it
 * may, as today's rules allow). The returned text completes "This PR counts as motion or
 * performance work (...)".
 */
export function noGrowthReason({ title = "", labels = [], changedFiles = [] }) {
  const label = labels.find((name) => NO_GROWTH_PATTERN.test(name));
  if (label) return `labelled "${label}"`;
  const word = String(title).match(NO_GROWTH_PATTERN);
  if (word) return `title mentions "${word[0]}"`;
  const file = changedFiles.find(isMotionSource);
  if (file) return `changes motion source \`${file}\``;
  return null;
}

/**
 * Route-by-route differences between two reports. Apps in only one report are listed apart and
 * not compared (CI builds only the apps a PR affects, and builds the base for the same apps).
 */
export function compareReports(base, head) {
  const apps = [];
  const onlyBase = Object.keys(base.apps).filter((app) => !head.apps[app]);
  const onlyHead = Object.keys(head.apps).filter((app) => !base.apps[app]);
  for (const app of Object.keys(head.apps).filter((name) => base.apps[name])) {
    const b = base.apps[app];
    const h = head.apps[app];
    const routes = [...new Set([...Object.keys(b.routes), ...Object.keys(h.routes)])].sort();
    const changed = [];
    let unchanged = 0;
    for (const route of routes) {
      const before = b.routes[route];
      const after = h.routes[route];
      if (before && after && before.gzipBytes === after.gzipBytes) {
        unchanged += 1;
        continue;
      }
      changed.push({
        route,
        baseBytes: before?.gzipBytes ?? null,
        headBytes: after?.gzipBytes ?? null,
        deltaBytes: before && after ? after.gzipBytes - before.gzipBytes : null,
      });
    }
    apps.push({
      app,
      identical: b.clientDigest === h.clientDigest,
      routes: routes.length,
      unchanged,
      changed,
    });
  }
  const grown = apps.flatMap(({ app, changed }) =>
    changed.filter((row) => row.deltaBytes > 0).map((row) => ({ app, ...row })),
  );
  // A new page route adds start-up JavaScript a visitor did not download before. It is listed
  // apart from growth: the budgets still judge it, and a motion or performance PR fails on it.
  const added = apps.flatMap(({ app, changed }) =>
    changed.filter((row) => row.baseBytes === null).map((row) => ({ app, ...row })),
  );
  const changedCount = apps.reduce((sum, app) => sum + app.changed.length, 0);
  return { apps, onlyBase, onlyHead, grown, added, changedCount };
}

const kb = (bytes) => (bytes / 1024).toFixed(2);
const signedBytes = (bytes) => (bytes > 0 ? `+${bytes}` : String(bytes));
const signedKb = (bytes) => (bytes > 0 ? `+${kb(bytes)}` : kb(bytes));

/** The Markdown the job summary shows, and the console prints. */
export function renderMarkdown(
  result,
  { base, head, reason, heading = "Route JS: base vs head", requireUnchanged = false },
) {
  const lines = [
    `### ${heading}`,
    "",
    `Base \`${base.label ?? "base"}\`, head \`${head.label ?? "head"}\`. Gzip start-up JavaScript per page route, exact bytes (KB of 1024 bytes). Both are deterministic size builds: a route that did not change shows no row.`,
    "",
  ];
  if (result.apps.length === 0) lines.push("No app was built for both base and head.", "");
  for (const app of result.apps) {
    const digest = app.identical ? "client scripts byte-identical" : "client scripts differ";
    lines.push(
      `**${app.app}**: ${app.changed.length} of ${app.routes} routes changed (${digest})`,
      "",
    );
    if (app.changed.length === 0) continue;
    lines.push(
      "| Route | Base KB | Head KB | Delta KB | Delta bytes |",
      "| --- | ---: | ---: | ---: | ---: |",
    );
    const rows = [...app.changed].sort(
      (a, b) => (b.deltaBytes ?? 0) - (a.deltaBytes ?? 0) || a.route.localeCompare(b.route),
    );
    for (const row of rows) {
      if (row.baseBytes === null) {
        lines.push(`| \`${row.route}\` | new | ${kb(row.headBytes)} | | |`);
      } else if (row.headBytes === null) {
        lines.push(`| \`${row.route}\` | ${kb(row.baseBytes)} | removed | | |`);
      } else {
        lines.push(
          `| \`${row.route}\` | ${kb(row.baseBytes)} | ${kb(row.headBytes)} | ${signedKb(row.deltaBytes)} | ${signedBytes(row.deltaBytes)} |`,
        );
      }
    }
    lines.push("");
  }
  for (const app of result.onlyHead) lines.push(`${app}: built for head only; not compared.`);
  for (const app of result.onlyBase) lines.push(`${app}: built for base only; not compared.`);
  if (result.onlyHead.length + result.onlyBase.length > 0) lines.push("");
  if (requireUnchanged) {
    lines.push(
      selfCheckFailures(result) === 0
        ? "Self-check passed: the same commit built twice through the base route changed no route, and every app's client scripts are byte-identical."
        : '**Self-check failed:** the same commit built twice through the base route differs, so the size build is not deterministic. This run\'s base-vs-head table is not trusted and the job fails; fix the build determinism (docs/engineering/route-js-budgets.md, "Size builds are deterministic"). Re-running until it passes is not a fix.',
    );
    return lines.join("\n");
  }
  const grownText = `${result.grown.length} route(s) grew`;
  const addedText = result.added.length > 0 ? ` and ${result.added.length} route(s) are new` : "";
  const any = result.grown.length + result.added.length > 0;
  if (reason) {
    lines.push(
      any
        ? `**${grownText}${addedText}.** This PR counts as motion or performance work (${reason}): it may not grow any route or add one (docs/design/motion.md), so this step fails.`
        : `No route grew and no route is new. This PR counts as motion or performance work (${reason}), so any growth or new route would fail this step.`,
    );
  } else {
    lines.push(
      any
        ? `${grownText}${addedText}. Reported only: the budget and ratchet step above decides pass or fail for this PR.`
        : "No route grew and no route is new.",
    );
  }
  return lines.join("\n");
}

/**
 * What the self-check counts as a failure: any route that differs, any app whose client scripts
 * are not byte-identical, or an app on one side only. Two builds of one commit must be the same.
 */
export function selfCheckFailures(result) {
  const differing = result.apps.filter((app) => !app.identical).length;
  return result.changedCount + differing + result.onlyBase.length + result.onlyHead.length;
}

export function main(argv, { env = process.env, log = console.log } = {}) {
  let args;
  let base;
  let head;
  let reason;
  try {
    args = parseArgs(argv, env);
    reason = noGrowthReason({
      title: args.title,
      labels: parseLabels(args.labels),
      changedFiles: readChangedFiles(args.changedFiles),
    });
    base = JSON.parse(readFileSync(args.base, "utf8"));
    head = JSON.parse(readFileSync(args.head, "utf8"));
    for (const report of [base, head]) {
      if (report.version !== REPORT_VERSION) {
        throw new UsageError(`report version ${report.version}, expected ${REPORT_VERSION}`);
      }
    }
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const result = compareReports(base, head);
  const { heading, requireUnchanged } = args;
  const markdown = renderMarkdown(result, { base, head, reason, heading, requireUnchanged });
  log(markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  if (requireUnchanged) {
    for (const app of result.apps) {
      for (const row of app.changed) {
        log(
          `error: ${app.app} ${row.route} differs between two builds of one commit (${row.baseBytes ?? "missing"} -> ${row.headBytes ?? "missing"} bytes)`,
        );
      }
    }
    for (const app of result.apps) {
      if (!app.identical)
        log(`error: ${app.app} client scripts differ between two builds of one commit`);
    }
    for (const app of [...result.onlyBase, ...result.onlyHead]) {
      log(`error: ${app} was built on one side only`);
    }
    return selfCheckFailures(result) > 0 ? 1 : 0;
  }
  for (const row of result.grown) {
    const message = `${row.app} ${row.route} grew by ${row.deltaBytes} bytes (${kb(row.deltaBytes)} KB gzip) against the base`;
    log(reason ? `error: ${message}` : `::notice title=Route JS vs base::${message}`);
  }
  for (const row of result.added) {
    const message = `${row.app} ${row.route} is a new route (${kb(row.headBytes)} KB gzip)`;
    log(reason ? `error: ${message}` : `::notice title=Route JS vs base::${message}`);
  }
  return reason && result.grown.length + result.added.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
