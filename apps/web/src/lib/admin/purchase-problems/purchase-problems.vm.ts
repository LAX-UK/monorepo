import type { PurchaseProblemCategory, PurchaseProblemStatus } from "@auction/domain";

/**
 * Words, tones and counts for the Purchase problems screens. Every vocabulary is one table keyed
 * by the domain's own union, so adding a value there fails the build here until it has a label.
 */

export const PURCHASE_PROBLEMS_PATH = "/admin/purchase-problems";

/** The statuses in the order the tabs and the status filter list them. */
export const PURCHASE_PROBLEM_STATUS_ORDER = [
  "open",
  "in_progress",
  "resolved",
] as const satisfies readonly PurchaseProblemStatus[];

export const PURCHASE_PROBLEM_STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
} as const satisfies Record<PurchaseProblemStatus, string>;

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
type BadgeShape = "ring" | "dot" | "check" | "alert";

export const PURCHASE_PROBLEM_STATUS_BADGES = {
  open: { tone: "warning", shape: "ring" },
  in_progress: { tone: "info", shape: "dot" },
  resolved: { tone: "success", shape: "check" },
} as const satisfies Record<PurchaseProblemStatus, { tone: BadgeTone; shape: BadgeShape }>;

/** What the buyer reported, in the words staff use. */
export const PURCHASE_PROBLEM_CATEGORY_LABELS = {
  not_as_described: "Not as described",
  damaged: "Damaged",
  not_received: "Not received",
  invoice_or_payment: "Invoice or payment",
  other: "Other",
} as const satisfies Record<PurchaseProblemCategory, string>;

/** The state of the payment the report was raised against. */
const PAYMENT_STATE_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  authorized: "Authorised",
  captured: "Paid",
  refunded: "Refunded",
  requires_manual_review: "Held for review",
  cancelled: "Cancelled",
};

export function paymentStateLabel(status: string): string {
  return PAYMENT_STATE_LABELS[status] ?? "Unknown";
}

/** "Lot 12" or, for a lot outside a numbered sale, its title alone. */
export function lotLabel(lot: { title: string; lotNumber: number | null }): {
  primary: string;
  secondary: string | null;
} {
  return lot.lotNumber === null
    ? { primary: lot.title, secondary: null }
    : { primary: lot.title, secondary: `Lot ${lot.lotNumber}` };
}

export type PurchaseProblemTab = {
  id: PurchaseProblemStatus;
  label: string;
  count: number;
};

/** The status tabs, each with how many reports it holds for the current filters. */
export function purchaseProblemTabs(
  counts: Record<PurchaseProblemStatus, number> | null,
): PurchaseProblemTab[] {
  return PURCHASE_PROBLEM_STATUS_ORDER.map((id) => ({
    id,
    label: PURCHASE_PROBLEM_STATUS_LABELS[id],
    count: counts?.[id] ?? 0,
  }));
}

export const PURCHASE_PROBLEM_EMPTY_COPY = {
  open: {
    title: "No open purchase problems",
    description: "When a buyer reports a problem with a paid purchase, it appears here.",
  },
  in_progress: {
    title: "Nothing in progress",
    description: "Reports someone has taken on are listed here until they are resolved.",
  },
  resolved: {
    title: "No resolved purchase problems yet",
    description: "Reports you resolve are kept here with what was done.",
  },
} as const satisfies Record<PurchaseProblemStatus, { title: string; description: string }>;

/** How every tab orders its rows, said once under the table. */
export const PURCHASE_PROBLEM_ORDER_NOTE = "Longest waiting first";

/** "1–25 of 61 reports" for the page the list is on. */
export function purchaseProblemsSummary(page: {
  page: number;
  pageSize: number;
  total: number;
  itemCount: number;
}): string | null {
  if (page.itemCount === 0) return null;
  const noun = page.total === 1 ? "report" : "reports";
  if (page.total <= page.pageSize) return `${page.total} ${noun}`;
  const first = (page.page - 1) * page.pageSize + 1;
  const last = first + page.itemCount - 1;
  return `${first}–${last} of ${page.total} reports`;
}
