/**
 * Route JavaScript budget rule: pure functions shared by `check-route-js-budget.mjs` and its tests.
 *
 * A route's first load is every script its `app-build-manifest.json` entry lists plus the root main
 * files (framework, polyfills and runtime every page needs). The size is the sum of each file
 * gzipped on its own, which is what a browser downloads. Code fetched later (a dynamic import) is
 * not in the manifest and not counted.
 */

const KB = 1024;
const PAGE_SUFFIX = "/page";

/** The files a route loads first: the root main files and the route's own, scripts only. */
export function firstLoadFiles(appManifest, buildManifest, routeKey) {
  const listed = appManifest.pages?.[routeKey];
  if (!listed) return null;
  return [...new Set([...(buildManifest.rootMainFiles ?? []), ...listed])].filter((file) =>
    file.endsWith(".js"),
  );
}

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

/** One row per audited page route, with its gzip size against its group's budget. */
export function auditApp({ app, appConfig, appManifest, buildManifest, gzipKbOf }) {
  return pageRoutes(appManifest)
    .filter((route) => !isIgnored(appConfig, route))
    .map((route) => {
      const group = groupOf(appConfig, route);
      const files = firstLoadFiles(appManifest, buildManifest, route);
      return {
        app,
        route,
        group,
        gzipKb: files.reduce((sum, file) => sum + gzipKbOf(file), 0),
        budgetKb: appConfig.groups[group].budgetKb,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || b.gzipKb - a.gzipKb);
}

/** Current budget plus 10%, rounded up to a whole KB: what a group's budget is set to today. */
export function suggestBudgetKb(rows) {
  return Math.ceil(Math.max(...rows.map((row) => row.gzipKb)) * 1.1);
}

/**
 * What to print and whether to fail. Over-budget routes are GitHub warning annotations while
 * `enforce` is false and error lines that fail the run once it is true.
 */
export function verdict(rows, { enforce }) {
  const over = rows.filter((row) => row.gzipKb > row.budgetKb);
  const lines = over.map((row) => {
    const message = `${row.app} ${row.route} loads ${row.gzipKb.toFixed(1)} KB of JavaScript (gzip); the ${row.group} budget is ${row.budgetKb} KB`;
    return enforce ? `error: ${message}` : `::warning title=Route JS budget::${message}`;
  });
  return { lines, over, failed: enforce && over.length > 0 };
}

/** Per app and group: route count, largest route and the budget, as a plain-text table. */
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
      `${largest.gzipKb.toFixed(1)} KB`,
      `${largest.budgetKb} KB`,
      over === 0 ? "ok" : `${over} over`,
      largest.route,
    ];
  });
  return renderTable(
    ["app", "group", "routes", "largest", "budget", "status", "largest route"],
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
    ["app", "group", "size", "budget", "route"],
    rows.map((row) => [
      row.app,
      row.group,
      `${row.gzipKb.toFixed(1)} KB`,
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
