import { buildListHref } from "@/lib/admin/admin-list-params";
import { PURCHASE_PROBLEM_STATUSES, type PurchaseProblemStatus } from "@auction/domain";
import { PURCHASE_PROBLEMS_PATH } from "./purchase-problems.vm";

export type PurchaseProblemsSearch = Record<string, string | string[] | undefined>;

/** The list's state as the URL carries it. */
export type PurchaseProblemsFilters = {
  status: PurchaseProblemStatus;
  q: string;
  saleId: string;
  /** A staff id, or "unassigned". */
  assignee: string;
  page: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parsePurchaseProblemsSearch(sp: PurchaseProblemsSearch): PurchaseProblemsFilters {
  const status = first(sp.status);
  const saleId = first(sp.sale);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    status: (PURCHASE_PROBLEM_STATUSES as readonly string[]).includes(status)
      ? (status as PurchaseProblemStatus)
      : "open",
    q: first(sp.q).slice(0, 120),
    saleId: UUID.test(saleId) ? saleId : "",
    assignee: first(sp.assignee).slice(0, 100),
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Whether a search or filter narrows the list (the status tab alone does not). */
export function hasPurchaseProblemsFilters(filters: PurchaseProblemsFilters): boolean {
  return Boolean(filters.q || filters.saleId || filters.assignee);
}

/** What `GET /admin/purchase-problems` takes for these filters. */
export function purchaseProblemsApiQuery(
  filters: PurchaseProblemsFilters,
  limit = 25,
): URLSearchParams {
  const query = new URLSearchParams({
    status: filters.status,
    page: String(filters.page),
    limit: String(limit),
  });
  if (filters.q) query.set("q", filters.q);
  if (filters.saleId) query.set("saleId", filters.saleId);
  if (filters.assignee) query.set("assignee", filters.assignee);
  return query;
}

type Patch = Record<string, string | number | null | undefined>;

/** The list URL with `patch` applied; any change other than the page returns to page one. */
export function purchaseProblemsHref(current: PurchaseProblemsSearch, patch: Patch): string {
  const next: Patch = { page: null, ...patch };
  // Open is where the list lands, so it keeps the URL clean.
  if (next.status === "open") next.status = null;
  return buildListHref(PURCHASE_PROBLEMS_PATH, current, next);
}

/** One report's page. */
export function purchaseProblemHref(id: string): string {
  return `${PURCHASE_PROBLEMS_PATH}/${encodeURIComponent(id)}`;
}

export type PurchaseProblemsFilterChip = { id: string; label: string; clearHref: string };

type ChipLabels = {
  sale: (value: string) => string;
  assignee: (value: string) => string;
};

/** One removable chip per filter that is on, worded as the filter reads in the sheet. */
export function buildPurchaseProblemsChips(
  filters: PurchaseProblemsFilters,
  current: PurchaseProblemsSearch,
  labels: ChipLabels,
): PurchaseProblemsFilterChip[] {
  const entries = [
    { id: "sale", name: "Sale", value: filters.saleId, label: labels.sale, param: "sale" },
    {
      id: "assignee",
      name: "Owner",
      value: filters.assignee,
      label: labels.assignee,
      param: "assignee",
    },
  ] as const;
  return entries.flatMap((entry) =>
    entry.value
      ? [
          {
            id: entry.id,
            label: `${entry.name}: ${entry.label(entry.value)}`,
            clearHref: purchaseProblemsHref(current, { [entry.param]: null }),
          },
        ]
      : [],
  );
}

/** Previous and next links for the page the list is on. */
export function purchaseProblemsPagination(
  current: PurchaseProblemsSearch,
  page: { page: number; pageSize: number; total: number },
): { prevHref: string | null; nextHref: string | null } {
  const hasNext = page.page * page.pageSize < page.total;
  return {
    prevHref:
      page.page > 1
        ? purchaseProblemsHref(current, { page: page.page - 1 > 1 ? page.page - 1 : null })
        : null,
    nextHref: hasNext ? purchaseProblemsHref(current, { page: page.page + 1 }) : null,
  };
}
