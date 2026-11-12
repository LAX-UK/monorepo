/**
 * Per-route ratchet: pure functions shared by `check-route-js-budget.mjs` and its tests.
 *
 * The group budgets in `route-js-budgets.json` stop a group's largest page growing. The ratchet is
 * stricter and per route: each tracked route records the size it was measured at (`gzipKb`, what
 * a phone transfers, and `parsedKb`, what the browser parses) and the target it is being brought
 * down to (`targetKb`). A build fails when a tracked route exceeds its recorded size by more than
 * the tolerance. After a page is slimmed, `--write-baseline` records the new, lower size; the
 * targets stay as they are.
 */

const KB = 1024;
const ROUND = 10;

/** Round up to 0.1 KB so a recorded size never sits below the measurement it came from. */
const ceil1 = (value) => Math.ceil(value * ROUND) / ROUND;

/** Key of a route in the baseline file: app and route key, for example `apps/web /(marketing)/page`. */
export const baselineKey = (row) => `${row.app} ${row.route}`;

/** Sizes of one row, as recorded in the baseline. */
function measured(row) {
  return {
    gzipKb: ceil1(row.gzipKb),
    parsedKb: ceil1(row.parsedKb),
    frameKb: ceil1(row.frameKb),
    pageKb: ceil1(row.pageKb),
    duplicateCount: row.duplicateCount,
    duplicateKb: ceil1(row.duplicateKb),
    files: row.files,
  };
}

/**
 * A baseline for the tracked routes. `tracked` maps a baseline key to its label and target; the
 * rows supply the sizes. A tracked route missing from the rows is an error, not a silent skip.
 */
export function buildBaseline({ rows, tracked, toleranceKb, measuredWith }) {
  const routes = {};
  for (const [key, { label, targetKb }] of Object.entries(tracked)) {
    const row = rows.find((candidate) => baselineKey(candidate) === key);
    if (!row) throw new Error(`tracked route ${key} is not in the build`);
    routes[key] = { label, targetKb, ...measured(row) };
  }
  return { measuredWith, toleranceKb, routes };
}

const appOf = (key) => key.slice(0, key.indexOf(" "));

/**
 * Refreshes the sizes of the tracked routes of the measured `apps`, keeping each route's label and
 * target. Routes of apps that were not measured are kept exactly as recorded.
 */
export function refreshBaseline({ rows, baseline, apps }) {
  const entries = Object.entries(baseline.routes);
  const measuredEntries = entries.filter(([key]) => apps.includes(appOf(key)));
  const refreshed = buildBaseline({
    rows,
    tracked: Object.fromEntries(
      measuredEntries.map(([key, { label, targetKb }]) => [key, { label, targetKb }]),
    ),
    toleranceKb: baseline.toleranceKb,
    measuredWith: baseline.measuredWith,
  });
  return {
    ...refreshed,
    routes: Object.fromEntries(
      entries.map(([key, entry]) => [key, refreshed.routes[key] ?? entry]),
    ),
  };
}

/**
 * Tracked routes of the audited apps that exceed their recorded size by more than the tolerance,
 * and tracked routes of an audited app that the build no longer has. `apps` are the apps whose
 * rows were measured; routes of other apps are not judged.
 */
export function ratchetResult({ rows, baseline, apps }) {
  const over = [];
  const missing = [];
  const lowered = [];
  for (const [key, recorded] of Object.entries(baseline.routes)) {
    if (!apps.includes(appOf(key))) continue;
    const row = rows.find((candidate) => baselineKey(candidate) === key);
    if (!row) {
      missing.push(key);
      continue;
    }
    if (row.gzipKb > recorded.gzipKb + baseline.toleranceKb) {
      over.push({ key, label: recorded.label, recorded, row });
    } else if (row.gzipKb < recorded.gzipKb - baseline.toleranceKb) {
      lowered.push({ key, label: recorded.label, recorded, row });
    }
  }
  return { over, missing, lowered };
}

const kb = (value) => `${value.toFixed(1)} KB`;

/** CI log lines: errors for routes over their ratchet, notices for routes that can be lowered. */
export function ratchetLines({ over, missing, lowered }) {
  return [
    ...over.map(
      ({ label, recorded, row }) =>
        `error: ${label} (${row.app} ${row.route}) loads ${kb(row.gzipKb)} of JavaScript (gzip), over its ratchet of ${kb(recorded.gzipKb)} (+${kb(row.gzipKb - recorded.gzipKb)}). Remove what made it heavier; if the increase is intended and approved, record it with --write-baseline.`,
    ),
    ...missing.map(
      (key) =>
        `error: ratchet route ${key} is not in the build; update scripts/route-js-baseline.json`,
    ),
    ...lowered.map(
      ({ label, recorded, row }) =>
        `::notice title=Route JS ratchet::${label} is ${kb(row.gzipKb)}, below its ratchet of ${kb(recorded.gzipKb)}. Lower it with --write-baseline so the gain is kept.`,
    ),
  ];
}

/** Table of tracked routes: measured against ratchet and target. */
export function ratchetTable({ rows, baseline, apps }) {
  const header = ["route", "gzip", "ratchet", "target", "to cut", "parsed", "frame", "page", "dup"];
  const body = Object.entries(baseline.routes)
    .filter(([key]) => apps.includes(appOf(key)))
    .map(([key, recorded]) => {
      const row = rows.find((candidate) => baselineKey(candidate) === key);
      const size = row ? row.gzipKb : Number.NaN;
      return [
        recorded.label,
        row ? kb(size) : "missing",
        kb(recorded.gzipKb),
        `${recorded.targetKb} KB`,
        row ? kb(Math.max(0, size - recorded.targetKb)) : "-",
        row ? kb(row.parsedKb) : "-",
        row ? kb(row.frameKb) : "-",
        row ? kb(row.pageKb) : "-",
        row ? `${row.duplicateCount} (${kb(row.duplicateKb)})` : "-",
      ];
    });
  const widths = header.map((title, i) =>
    Math.max(title.length, ...body.map((cells) => cells[i].length)),
  );
  const line = (cells) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

export { KB };
