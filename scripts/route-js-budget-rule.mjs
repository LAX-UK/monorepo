/**
 * Route JavaScript budget rule: pure functions shared by `check-route-js-budget.mjs` and its tests.
 *
 * A route's size is what a phone downloads to start it: every script in its start-up set (see
 * `route-js-startup-set.mjs`), each gzipped on its own, which is what a browser downloads. A module
 * that two of those scripts both contain is shipped twice and counted twice. Code fetched later
 * (a dynamic import) is not in the set and not counted.
 */
import { duplicateModules } from "./route-js-chunk-modules.mjs";
import { startupSet } from "./route-js-startup-set.mjs";

const KB = 1024;
const PAGE_SUFFIX = "/page";

/** Page routes only: route handlers, layouts, loading and error boundaries are not navigations. */
export function pageRoutes(appManifest) {
  return Object.keys(appManifest.pages ?? {}).filter((key) => key.endsWith(PAGE_SUFFIX));
}

/** The URL-style path a route key is matched on: the key without its `/page` suffix. */
export function routePath(routeKey) {
  return routeKey.slice(0, -PAGE_SUFFIX.length) || "/";
}

/** The group a route belongs to: the first group whose pattern matches, else the fallback. */
export function groupOf(appConfig, routeKey) {
  const path = routePath(routeKey);
  for (const [name, group] of Object.entries(appConfig.groups)) {
    if ((group.match ?? []).some((pattern) => new RegExp(pattern).test(path))) return name;
  }
  return appConfig.fallback;
}

/** True for a route the config excludes from the audit (for example the staff admin area). */
export function isIgnored(appConfig, routeKey) {
  const path = routePath(routeKey);
  return (appConfig.ignore ?? []).some((pattern) => new RegExp(pattern).test(path));
}

/**
 * One row per audited page route: its start-up size against its group's budget, split into the
 * shared frame and the page's own files, plus the modules shipped twice. `chunkOf(file)` returns
 * `{ gzipKb, rawBytes, modules }`. A group's own `enforce` wins over the config-wide default.
 */
export function auditApp({ app, appConfig, appManifest, buildManifest, chunkOf, enforce = false }) {
  const sumKb = (files) => files.reduce((sum, file) => sum + chunkOf(file).gzipKb, 0);
  return pageRoutes(appManifest)
    .filter((route) => !isIgnored(appConfig, route))
    .map((route) => {
      const group = groupOf(appConfig, route);
      const { frame, page } = startupSet(appManifest, buildManifest, route);
      const files = [...frame, ...page];
      const duplicates = duplicateModules(Object.fromEntries(files.map((f) => [f, chunkOf(f)])));
      const groupConfig = appConfig.groups[group];
      return {
        app,
        route,
        group,
        files: files.length,
        gzipKb: sumKb(files),
        frameKb: sumKb(frame),
        pageKb: sumKb(page),
        duplicateCount: duplicates.count,
        duplicateKb: duplicates.kb,
        budgetKb: groupConfig.budgetKb,
        enforce: groupConfig.enforce ?? enforce,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || b.gzipKb - a.gzipKb);
}

/** Current budget plus 10%, rounded up to a whole KB: what a group's budget is set to today. */
export function suggestBudgetKb(rows) {
  return Math.ceil(Math.max(...rows.map((row) => row.gzipKb)) * 1.1);
}

/**
 * What to print and whether to fail. An over-budget route in an enforced group is an error line
 * that fails the run; in any other group it is a GitHub warning annotation.
 */
export function verdict(rows, { enforce = false } = {}) {
  const over = rows.filter((row) => row.gzipKb > row.budgetKb);
  const isEnforced = (row) => enforce || row.enforce === true;
  const lines = over.map((row) => {
    const message = `${row.app} ${row.route} loads ${row.gzipKb.toFixed(1)} KB of JavaScript (gzip); the ${row.group} budget is ${row.budgetKb} KB`;
    return isEnforced(row) ? `error: ${message}` : `::warning title=Route JS budget::${message}`;
  });
  return { lines, over, failed: over.some(isEnforced) };
}

const kbText = (kb) => `${kb.toFixed(1)} KB`;

/**
 * Per app and group, the largest route as the budget sees it: total, shared frame, the page's own
 * files, and the modules shipped twice, with the budget and whether it is enforced.
 */
export function summaryTable(rows) {
  const keys = [...new Set(rows.map((row) => `${row.app}\t${row.group}`))];
  const body = keys.map((key) => {
    const [app, group] = key.split("\t");
    const members = rows.filter((row) => row.app === app && row.group === group);
    const largest = members.reduce((a, b) => (b.gzipKb > a.gzipKb ? b : a));
    const over = members.filter((row) => row.gzipKb > row.budgetKb).length;
    return [
      app,
      group,
      String(members.length),
      kbText(largest.gzipKb),
      kbText(largest.frameKb),
      kbText(largest.pageKb),
      `${largest.duplicateCount} (${kbText(largest.duplicateKb)})`,
      `${largest.budgetKb} KB`,
      largest.enforce ? "enforced" : "warn",
      over === 0 ? "ok" : `${over} over`,
      largest.route,
    ];
  });
  return renderTable(
    [
      "app",
      "group",
      "routes",
      "largest",
      "frame",
      "page",
      "duplicates",
      "budget",
      "mode",
      "status",
      "largest route",
    ],
    body,
  );
}

/** Every over-budget route, largest overshoot first. */
export function overBudgetTable(rows) {
  const over = rows
    .filter((row) => row.gzipKb > row.budgetKb)
    .sort((a, b) => b.gzipKb - b.budgetKb - (a.gzipKb - a.budgetKb));
  return renderTable(
    ["app", "group", "size", "budget", "over by", "route"],
    over.map((row) => [
      row.app,
      row.group,
      `${row.gzipKb.toFixed(1)} KB`,
      `${row.budgetKb} KB`,
      `${(row.gzipKb - row.budgetKb).toFixed(1)} KB`,
      row.route,
    ]),
  );
}

/** Every audited route, for `--all`. */
export function fullTable(rows) {
  return renderTable(
    ["app", "group", "size", "frame", "page", "duplicates", "files", "budget", "route"],
    rows.map((row) => [
      row.app,
      row.group,
      kbText(row.gzipKb),
      kbText(row.frameKb),
      kbText(row.pageKb),
      `${row.duplicateCount} (${kbText(row.duplicateKb)})`,
      String(row.files),
      `${row.budgetKb} KB`,
      row.route,
    ]),
  );
}

function renderTable(header, body) {
  const widths = header.map((title, i) =>
    Math.max(title.length, ...body.map((row) => row[i].length)),
  );
  const line = (cells) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

export { KB };
