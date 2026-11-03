import { visibleSellDepartmentGroups } from "@/lib/marketing/sell-departments";
import { humaniseSlug } from "./enquiries.vm";

export type RoutingRule = { departmentSlug: string | null; assignedToUserId: string };

/** One line of the routing table. A null slug is the fallback. */
export type RoutingRow = { slug: string | null; label: string };

export const FALLBACK_LABEL = "Everything else, including buying privately";

/** The departments clients can choose on the enquiry page, plus any department already routed. */
export function routingRows(rules: readonly RoutingRule[]): RoutingRow[] {
  const known = visibleSellDepartmentGroups()
    .flatMap((group) => group.departments)
    .flatMap((department) =>
      department.slug ? [{ slug: department.slug, label: department.label }] : [],
    );
  const knownSlugs = new Set(known.map((department) => department.slug));
  const extra = rules.flatMap((rule) =>
    rule.departmentSlug && !knownSlugs.has(rule.departmentSlug)
      ? [{ slug: rule.departmentSlug, label: humaniseSlug(rule.departmentSlug) }]
      : [],
  );
  return [...known, ...extra, { slug: null, label: FALLBACK_LABEL }];
}

/** The draft the dialog edits: a staff id per row, "" for no one. */
export type RoutingDraft = Record<string, string>;

const FALLBACK_KEY = "__fallback";
export const draftKey = (slug: string | null): string => slug ?? FALLBACK_KEY;

export function draftFromRules(rules: readonly RoutingRule[]): RoutingDraft {
  return Object.fromEntries(
    rules.map((rule) => [draftKey(rule.departmentSlug), rule.assignedToUserId]),
  );
}

/** The table to save: only rows with a person. */
export function rulesFromDraft(rows: readonly RoutingRow[], draft: RoutingDraft): RoutingRule[] {
  return rows.flatMap((row) => {
    const person = draft[draftKey(row.slug)];
    return person ? [{ departmentSlug: row.slug, assignedToUserId: person }] : [];
  });
}

export function routingChanged(
  rows: readonly RoutingRow[],
  draft: RoutingDraft,
  saved: readonly RoutingRule[],
): boolean {
  const before = draftFromRules(saved);
  return rows.some(
    (row) => (draft[draftKey(row.slug)] ?? "") !== (before[draftKey(row.slug)] ?? ""),
  );
}

/**
 * Departments with no specialist, said in a sentence: where their enquiries go instead.
 * Null when every department has someone.
 */
export function unroutedWarning(
  rows: readonly RoutingRow[],
  draft: RoutingDraft,
  nameOf: (userId: string) => string,
): string | null {
  const missing = rows.filter((row) => row.slug !== null && !draft[draftKey(row.slug)]);
  if (missing.length === 0) return null;
  const names = missing.map((row) => row.label);
  const list =
    names.length === 1
      ? `${names[0]} has`
      : names.length <= 3
        ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)} have`
        : `${names.length} departments have`;
  const fallback = draft[draftKey(null)];
  return fallback
    ? `${list} no specialist. Their enquiries go to ${nameOf(fallback)}.`
    : `${list} no specialist. Their enquiries stay unassigned for client services to route.`;
}
