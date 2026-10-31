import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import { formatDateInline } from "@/lib/ui/format";
import type { TelephoneBidBookingStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import {
  type TelephoneBookingListItem,
  telephoneBookingStatusLabel,
} from "./telephone-booking-types";

/**
 * How each booking state is drawn: a line still to be confirmed or running now is information, a
 * confirmed line is good news, and a finished or cancelled one is neutral. The words are the ones
 * the booking's own page uses.
 */
const STATUS_BADGE: Record<
  TelephoneBidBookingStatus,
  { tone: StatusBadgeTone; shape: StatusBadgeShape }
> = {
  requested: { tone: "info", shape: "dot" },
  confirmed: { tone: "success", shape: "check" },
  in_progress: { tone: "info", shape: "dot" },
  completed: { tone: "neutral", shape: "ring" },
  cancelled: { tone: "neutral", shape: "ring" },
};

export type TelephoneBookingRowVm = {
  id: string;
  href: string;
  title: string;
  /** "Asked 28 Oct 2026", "3 lots". */
  meta: string[];
  status: { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };
  /** The most we may bid for the person on the line; `null` when there is none to show. */
  figure: { value: string; label: string; pending?: true } | null;
};

function lotsLabel(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? "1 lot" : `${count} lots`;
}

/** One telephone line the person booked, as a row of My bids. */
export function telephoneBookingRow(row: TelephoneBookingListItem): TelephoneBookingRowVm {
  const lots = lotsLabel(row.lotIds.length);
  return {
    id: row.id,
    href: `/bids/telephone/${row.id}`,
    title: row.saleTitle?.trim() || "Onsite sale",
    meta: [`Asked ${formatDateInline(row.createdAt)}`, ...(lots ? [lots] : [])],
    status: { label: telephoneBookingStatusLabel(row.status), ...STATUS_BADGE[row.status] },
    figure: row.authorizedMax
      ? { value: formatPounds(row.authorizedMax), label: "your maximum" }
      : row.status === "requested"
        ? { value: "Not set yet", label: "your maximum", pending: true }
        : null,
  };
}
