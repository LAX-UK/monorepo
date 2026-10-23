import {
  dashboardCheckoutLotUrl,
  dashboardSofRequirementsUrl,
} from "@/lib/dashboard/dashboard-copy";
import type { MyPaymentRow } from "@/lib/data/http/payments.server";
import { formatMoney } from "@/lib/format-currency";
import { getPaymentStatusView } from "@/lib/presenters/payment-status";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";

/** Display-ready row consumed by the buyer payments page. Pure shape. */
export type PaymentDisplayRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  lotImageUrl: string | null;
  /** Pre-formatted total for direct rendering. */
  amountLabel: string;
  /** Localised, sentence-case date for `<time>` children. */
  createdAtLabel: string;
  /** ISO-8601 string for the `<time dateTime>` attribute. */
  createdAtIso: string;
  status: PaymentStatus;
  statusLabel: string;
  statusTone: ReturnType<typeof getPaymentStatusView>["tone"];
  /** Primary action target. `"pay"` opens per-lot checkout; `"invoice"` opens
   * the hosted Xero invoice in a new tab; `"none"` shows nothing; `"review"`
   * indicates a compliance hold — show a reason label instead of a pay CTA. */
  primaryAction:
    | { kind: "pay"; href: string; label: string }
    | { kind: "invoice"; href: string; label: string; ariaLabel: string }
    | { kind: "review"; href: string; reason: ManualReviewReason }
    | { kind: "none" };
  invoiceNumber: string | null;
  /** Compliance or finance review reason, if known. */
  manualReviewReason: ManualReviewReason | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): { label: string; iso: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso, iso };
  return { label: DATE_FMT.format(d), iso: d.toISOString() };
}

/** Build the buyer's primary CTA per row. Pending → pay (unless compliance-held); otherwise invoice if known. */
function buildPrimaryAction(row: MyPaymentRow): PaymentDisplayRow["primaryAction"] {
  if (row.status === "pending") {
    const reason = row.manualReviewReason;
    if (reason === "aml_hold" || reason === "source_of_funds_required") {
      return {
        kind: "review",
        href:
          reason === "source_of_funds_required"
            ? dashboardSofRequirementsUrl()
            : dashboardCheckoutLotUrl(row.lotId),
        reason,
      };
    }
    return {
      kind: "pay",
      href: dashboardCheckoutLotUrl(row.lotId),
      label: "Pay now",
    };
  }
  if (row.status === "requires_manual_review") {
    const reason = row.manualReviewReason;
    if (reason) {
      return {
        kind: "review",
        href:
          reason === "source_of_funds_required"
            ? dashboardSofRequirementsUrl()
            : dashboardCheckoutLotUrl(row.lotId),
        reason,
      };
    }
  }
  if (row.invoiceUrl) {
    return {
      kind: "invoice",
      href: row.invoiceUrl,
      label: "View invoice",
      ariaLabel: `Open invoice for ${row.lotTitle} (opens in a new tab)`,
    };
  }
  return { kind: "none" };
}

/** Map API rows to display rows. Pure: deterministic, no IO, no globals beyond
 * the shared `Intl` formatter. */
export function toPaymentDisplayRows(rows: MyPaymentRow[]): PaymentDisplayRow[] {
  return rows.map((row) => {
    const view = getPaymentStatusView(row.status);
    const { label: createdAtLabel, iso: createdAtIso } = formatDate(row.createdAt);
    return {
      id: row.id,
      lotId: row.lotId,
      lotTitle: row.lotTitle,
      lotImageUrl: row.lotImageUrl,
      amountLabel: formatMoney(row.amount, row.currency),
      createdAtLabel,
      createdAtIso,
      status: row.status,
      statusLabel: view.label,
      statusTone: view.tone,
      primaryAction: buildPrimaryAction(row),
      invoiceNumber: row.invoiceNumber,
      manualReviewReason: row.manualReviewReason,
    };
  });
}

/** Most-recent first ordering. Stable for ties (uses original index). */
export function sortPaymentsNewestFirst(rows: PaymentDisplayRow[]): PaymentDisplayRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ta = Date.parse(a.row.createdAtIso);
      const tb = Date.parse(b.row.createdAtIso);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return a.index - b.index;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      if (tb !== ta) return tb - ta;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
