import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import type { AccountRegistrationView } from "@/lib/data/http/account-buying.types";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { matchesEveryWord } from "@/lib/workspace/list-search";
import { LONDON_TIME_ZONE, formatDateTime, formatDayMonthOnly } from "@auction/datetime";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

type RegistrationStatus = AccountRegistrationView["status"];

/** How each registration state reads, in the one table the row and its tests share. */
const STATUS: Record<
  RegistrationStatus,
  {
    label: string;
    tone: StatusBadgeTone;
    shape: StatusBadgeShape;
    /** The label under the limit figure while there is no limit to show. */
    noLimit: string;
  }
> = {
  approved: { label: "Approved", tone: "success", shape: "check", noLimit: "a lot" },
  pending: {
    label: "Pending review",
    tone: "info",
    shape: "dot",
    noLimit: "set when approved",
  },
  rejected: { label: "Not approved", tone: "danger", shape: "alert", noLimit: "ask us why" },
  withdrawn: { label: "Withdrawn", tone: "neutral", shape: "ring", noLimit: "withdrawn" },
};

/** Approved and waiting registrations first, then the rest; each newest sale first. */
const ORDER: Record<RegistrationStatus, number> = {
  pending: 0,
  approved: 0,
  rejected: 1,
  withdrawn: 2,
};

export type RegistrationRowVm = {
  id: string;
  saleId: string;
  title: string;
  /** "19 Nov 2026, 14:00 UK time", "paddle 1042", "asked 28 Oct", "registered by Tom Whitfield". */
  meta: string[];
  status: { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };
  figure: { value: string; label: string };
  /** The bids placed in this sale, when there is anything to see. */
  href: string | null;
  /** "Contact us" for a request that was not approved. */
  contact: boolean;
};

/** The per-sale view of Bids. */
export function saleBidsHref(saleId: string): string {
  return `${CLIENT_ROUTES.bids}?sale=${encodeURIComponent(saleId)}`;
}

function toRow(row: AccountRegistrationView, showRegisteredBy: boolean): RegistrationRowVm {
  const spec = STATUS[row.status];
  const meta = [`${formatDateTime(row.saleStartsAt, LONDON_TIME_ZONE)} UK time`];
  if (row.paddleNumber != null) meta.push(`paddle ${row.paddleNumber}`);
  if (row.status === "pending")
    meta.push(`asked ${formatDayMonthOnly(row.requestedAt, LONDON_TIME_ZONE)}`);
  if (showRegisteredBy && row.registeredBy.name)
    meta.push(`registered by ${row.registeredBy.name}`);
  return {
    id: row.id,
    saleId: row.saleId,
    title: row.saleTitle,
    meta,
    status: { label: spec.label, tone: spec.tone, shape: spec.shape },
    figure:
      row.status === "approved"
        ? { value: row.bidLimit ? formatPounds(row.bidLimit) : "No limit", label: "a lot" }
        : { value: "–", label: spec.noLimit },
    href: row.status === "approved" || row.status === "pending" ? saleBidsHref(row.saleId) : null,
    contact: row.status === "rejected",
  };
}

/**
 * The Sales view: one row per sale the account asked to bid in, with where the request stands
 * and the limit. `showRegisteredBy` names the member on a list shared by several bidders.
 */
export function buildRegistrationRows(
  rows: readonly AccountRegistrationView[],
  options: { showRegisteredBy: boolean; query?: string },
): RegistrationRowVm[] {
  return [...rows]
    .filter((row) => matchesEveryWord([row.saleTitle, row.registeredBy.name], options.query ?? ""))
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] || b.saleStartsAt.getTime() - a.saleStartsAt.getTime(),
    )
    .map((row) => toRow(row, options.showRegisteredBy));
}
