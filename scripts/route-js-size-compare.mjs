#!/usr/bin/env node
/**
 * Base-versus-head route JavaScript table for a pull request. Reads two reports written by
 * `route-js-size-report.mjs` (the PR's base commit and the PR, both built with the deterministic
 * size-build settings) and prints, per app, every route whose start-up JavaScript changed, in exact
 * gzip bytes. Identical builds give an empty table, so any number in it is a real change.
 *
 * It adds no rule of its own to the budget check. For most pull requests it only reports. For
 * motion or performance work (a label, or a title word, matching `NO_GROWTH_PATTERN`) any growth of
 * an existing route fails, because those changes promise no route JavaScript growth
 * (`docs/design/motion.md`); there is no allowance.
 *
 * Usage: node scripts/route-js-size-compare.mjs --base <base.json> --head <head.json>
 *                                               [--title <pr title>] [--labels <a,b>]
 *   --title, --labels  the pull request's title and labels; default PR_TITLE and PR_LABELS
 *                      (labels as a JSON array or comma-separated)
 *
 * Exit codes: 0 reported, 1 a motion or performance PR grew a route, 2 bad usage or reports.
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_VERSION } from "./route-js-size-report.mjs";

/** A label or a title word that marks motion or performance work. */
export const NO_GROWTH_PATTERN = /\b(motion|perf|performance)\b/i;

class UsageError extends Error {}

export function parseArgs(argv, env = {}) {
  const args = { base: null, head: null, title: env.PR_TITLE ?? "", labels: env.PR_LABELS ?? "" };
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
    else throw new UsageError(`unknown option ${arg}`);
  }
  if (!args.base || !args.head) throw new UsageError("--base and --head are required");
  return args;
}

/** Labels as given by the workflow: a JSON array of names, or a comma-separated list. */
export function parseLabels(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return parsed.map((label) => (typeof label === "string" ? label : label?.name)).filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

/** Why this PR may not grow any route (`null` when it may, as today's rules allow). */
export function noGrowthReason({ title = "", labels = [] }) {
  const label = labels.find((name) => NO_GROWTH_PATTERN.test(name));
  if (label) return `labelled "${label}"`;
  const word = String(title).match(NO_GROWTH_PATTERN);
  if (word) return `title mentions "${word[0]}"`;
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
  return { apps, onlyBase, onlyHead, grown };
}

const kb = (bytes) => (bytes / 1024).toFixed(2);
const signedBytes = (bytes) => (bytes > 0 ? `+${bytes}` : String(bytes));
const signedKb = (bytes) => (bytes > 0 ? `+${kb(bytes)}` : kb(bytes));

/** The Markdown the job summary shows, and the console prints. */
export function renderMarkdown(result, { base, head, reason }) {
  const lines = [
    "### Route JS: base vs head",
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
  if (reason) {
    lines.push(
      result.grown.length === 0
        ? `No route grew. This PR is ${reason}, so any growth would fail this step.`
        : `**${result.grown.length} route(s) grew.** This PR is ${reason}: motion and performance work may not grow any route (docs/design/motion.md), so this step fails.`,
    );
  } else {
    lines.push(
      result.grown.length === 0
        ? "No route grew."
        : `${result.grown.length} route(s) grew. Reported only: the budget and ratchet step above decides pass or fail for this PR.`,
    );
  }
  return lines.join("\n");
}

export function main(argv, { env = process.env, log = console.log } = {}) {
  let args;
  let base;
  let head;
  try {
    args = parseArgs(argv, env);
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
  const reason = noGrowthReason({ title: args.title, labels: parseLabels(args.labels) });
  const result = compareReports(base, head);
  const markdown = renderMarkdown(result, { base, head, reason });
  log(markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  for (const row of result.grown) {
    const message = `${row.app} ${row.route} grew by ${row.deltaBytes} bytes (${kb(row.deltaBytes)} KB gzip) against the base`;
    log(reason ? `error: ${message}` : `::notice title=Route JS vs base::${message}`);
  }
  return reason && result.grown.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
