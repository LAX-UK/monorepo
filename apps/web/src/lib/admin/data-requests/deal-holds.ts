import type { DealHold } from "@/lib/data/http/admin-data-requests.reader";
import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";

/** What staff read for one deal: its reference and how long it keeps the person's records. */
export function dealHoldLine(hold: DealHold): { reference: string; text: string } {
  switch (hold.status) {
    case "running":
      return {
        reference: hold.dealReference,
        text: hold.heldUntil
          ? `Kept until ${formatDate(new Date(hold.heldUntil), LONDON_TIME_ZONE, { month: "long" })}`
          : "Kept while the retention runs",
      };
    case "open":
      return {
        reference: hold.dealReference,
        text: "Kept until the deal ends, then for the retention period",
      };
    case "end_unknown":
      return {
        reference: hold.dealReference,
        text: "Kept; the deal's end is not recorded, so compliance has been asked to look at it",
      };
  }
}
