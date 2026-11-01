/**
 * The accessibility gate for the public site. Serious and critical violations always fail.
 * Moderate ones are checked against a committed baseline that can only shrink: a violation that
 * is not in the baseline fails, and so does a baseline entry that no longer occurs (remove it).
 * Pure functions, so the rule is tested without a browser.
 */

export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

export type FoundViolation = {
  /** The route's name from `public-routes.ts`. */
  route: string;
  rule: string;
  impact: AxeImpact | null | undefined;
  /** Viewport and theme the violation appeared in, e.g. "1440 dark". */
  variant: string;
};

/** Rule ids per route, for the moderate violations still allowed. */
export type A11yBaseline = Record<string, string[]>;

export type RatchetResult = {
  blocking: FoundViolation[];
  newModerate: FoundViolation[];
  fixedModerate: { route: string; rule: string }[];
};

const BLOCKING: ReadonlySet<string> = new Set(["serious", "critical"]);

export function evaluateRatchet(
  found: readonly FoundViolation[],
  baseline: A11yBaseline,
  routesChecked: readonly string[],
): RatchetResult {
  const blocking = found.filter((v) => v.impact && BLOCKING.has(v.impact));
  const moderate = found.filter((v) => v.impact === "moderate");

  const allowed = (route: string) => new Set(baseline[route] ?? []);
  const newModerate = moderate.filter((v) => !allowed(v.route).has(v.rule));

  const seen = new Set(moderate.map((v) => `${v.route}\u0000${v.rule}`));
  const checked = new Set(routesChecked);
  const fixedModerate = Object.entries(baseline).flatMap(([route, rules]) =>
    checked.has(route)
      ? rules.filter((rule) => !seen.has(`${route}\u0000${rule}`)).map((rule) => ({ route, rule }))
      : [],
  );

  return { blocking, newModerate, fixedModerate };
}

export function describeRatchet(result: RatchetResult): string[] {
  const line = (v: FoundViolation) => `${v.route} [${v.variant}] ${v.rule} (${v.impact})`;
  return [
    ...result.blocking.map((v) => `blocking: ${line(v)}`),
    ...result.newModerate.map((v) => `not in baseline: ${line(v)}`),
    ...result.fixedModerate.map(
      (f) => `fixed, remove from e2e/a11y-baseline.json: ${f.route} ${f.rule}`,
    ),
  ];
}
