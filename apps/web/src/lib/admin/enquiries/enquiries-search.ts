import { buildListHref } from "@/lib/admin/admin-list-params";
import type { EnquiryIntent, EnquiryStatus, EnquiryView } from "@auction/domain";
import { ENQUIRIES_PATH, ENQUIRY_VIEW_IDS } from "./enquiries.vm";

export type EnquiriesSearch = Record<string, string | string[] | undefined>;

const KINDS = [
  "general",
  "private_sale_sell",
  "private_sale_buy",
  "buying",
  "selling",
  "shipping",
  "press",
] as const satisfies readonly EnquiryIntent[];

const STATUSES = [
  "new",
  "in_progress",
  "waiting_on_client",
  "converted",
  "closed",
] as const satisfies readonly EnquiryStatus[];

/** The list's state as the URL carries it. Cursors are opaque; `trail` holds the pages before this one. */
export type EnquiriesFilters = {
  view: EnquiryView;
  kind: EnquiryIntent | "";
  department: string;
  status: EnquiryStatus | "";
  /** A staff id, or "unassigned". */
  assignee: string;
  cursor: string;
  trail: string[];
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function parseTrail(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string" && c.length <= 300).slice(-40)
      : [];
  } catch {
    return [];
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `defaultView` is the view this person lands on: their own queue, or everything open. */
export function parseEnquiriesSearch(
  sp: EnquiriesSearch,
  defaultView: EnquiryView,
): EnquiriesFilters {
  const department = first(sp.department).slice(0, 80);
  return {
    view: oneOf(first(sp.view), ENQUIRY_VIEW_IDS) || defaultView,
    kind: oneOf(first(sp.kind), KINDS),
    department: SLUG.test(department) ? department : "",
    status: oneOf(first(sp.status), STATUSES),
    assignee: first(sp.assignee).slice(0, 100),
    cursor: first(sp.cursor).slice(0, 300),
    trail: parseTrail(first(sp.trail)),
  };
}

/** Whether a filter narrows the list (the view tab alone does not). */
export function hasEnquiriesFilters(filters: EnquiriesFilters): boolean {
  return Boolean(filters.kind || filters.department || filters.status || filters.assignee);
}

/** What `GET /admin/enquiries` takes for these filters. */
export function enquiriesApiQuery(filters: EnquiriesFilters, limit = 25): URLSearchParams {
  const query = new URLSearchParams({ view: filters.view, limit: String(limit) });
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.department) query.set("department", filters.department);
  if (filters.status) query.set("status", filters.status);
  if (filters.assignee) query.set("assignee", filters.assignee);
  if (filters.cursor) query.set("cursor", filters.cursor);
  return query;
}

type Patch = Record<string, string | number | null | undefined>;

/** The list URL with `patch` applied; any filter change returns to the first page. */
export function enquiriesHref(
  current: EnquiriesSearch,
  patch: Patch,
  defaultView: EnquiryView,
): string {
  const next: Patch = { cursor: null, trail: null, ...patch };
  // The view this person lands on keeps the URL clean.
  if (next.view === defaultView) next.view = null;
  return buildListHref(ENQUIRIES_PATH, current, next);
}

/** An enquiry's page, by the reference staff and clients quote. */
export function enquiryHref(reference: string): string {
  return `${ENQUIRIES_PATH}/${encodeURIComponent(reference)}`;
}

export type EnquiriesFilterChip = { id: string; label: string; clearHref: string };

type ChipLabels = {
  kind: (value: string) => string;
  department: (value: string) => string;
  status: (value: string) => string;
  assignee: (value: string) => string;
};

/** One removable chip per filter that is on, worded as the filter reads in the sheet. */
export function buildEnquiriesChips(
  filters: EnquiriesFilters,
  current: EnquiriesSearch,
  defaultView: EnquiryView,
  labels: ChipLabels,
): EnquiriesFilterChip[] {
  const entries: Array<
    [keyof Pick<EnquiriesFilters, "kind" | "department" | "status" | "assignee">, string]
  > = [
    ["kind", "Kind"],
    ["department", "Department"],
    ["status", "Status"],
    ["assignee", "Assignee"],
  ];
  return entries.flatMap(([key, name]) =>
    filters[key]
      ? [
          {
            id: key,
            label: `${name}: ${labels[key](filters[key])}`,
            clearHref: enquiriesHref(current, { [key]: null }, defaultView),
          },
        ]
      : [],
  );
}

/** Previous and next links for a cursor list: the pages before this one ride along in `trail`. */
export function enquiriesPagination(
  current: EnquiriesSearch,
  filters: EnquiriesFilters,
  defaultView: EnquiryView,
  page: { itemCount: number; nextCursor: string | null },
): { summary: string; prevHref: string | null; nextHref: string | null } | null {
  if (page.itemCount === 0) return null;
  const earlier = filters.trail;
  const previous = earlier.length > 0 ? earlier[earlier.length - 1] : undefined;
  const noun = page.itemCount === 1 ? "enquiry" : "enquiries";
  const number = earlier.length + 1;
  return {
    summary:
      number === 1 && !page.nextCursor
        ? `${page.itemCount} ${noun}`
        : `Page ${number} · ${page.itemCount} ${noun}`,
    prevHref:
      previous === undefined
        ? null
        : enquiriesHref(
            current,
            {
              cursor: previous || null,
              trail: earlier.length > 1 ? JSON.stringify(earlier.slice(0, -1)) : null,
            },
            defaultView,
          ),
    nextHref: page.nextCursor
      ? enquiriesHref(
          current,
          { cursor: page.nextCursor, trail: JSON.stringify([...earlier, filters.cursor]) },
          defaultView,
        )
      : null,
  };
}
