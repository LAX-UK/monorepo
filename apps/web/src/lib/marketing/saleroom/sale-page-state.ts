import { formatLondonDayMonth, formatLondonWeekday } from "@/lib/datetime/london-time";
import type { Sale } from "@auction/types";

/**
 * What the sale page is, before any of its sections: a cancelled sale is a notice, a scheduled sale
 * with nothing published yet is a promise of lots, everything else is the catalogue.
 * (The sale statuses are draft, scheduled, active, ended and cancelled; there is no postponed
 * status, so a postponed sale is a scheduled sale with its new dates.)
 */
export type SalePageState = "cancelled" | "preparing" | "catalogue";

export function resolveSalePageState(input: {
  status: Sale["status"];
  /** Lots the public catalogue holds, withdrawn included. */
  lotCount: number;
}): SalePageState {
  if (input.status === "cancelled") return "cancelled";
  if (input.status === "scheduled" && input.lotCount === 0) return "preparing";
  return "catalogue";
}

export type CataloguePreparingVM = {
  title: string;
  description: string;
};

/** "Mon 22 Feb": the weekday and the day, with the year only when it is not this year's. */
function formatLondonWeekdayDate(date: Date, now: Date): string {
  return `${formatLondonWeekday(date)} ${formatLondonDayMonth(date, now)}`;
}

/**
 * The words for a scheduled sale whose lots are not online yet. Lots go online from the preview,
 * else from the start; a date already passed is not promised, and a closed consignment window is
 * left out rather than shown as a deadline.
 */
export function cataloguePreparingCopy(
  sale: Pick<Sale, "startTime" | "previewStartTime" | "consignmentDeadline">,
  now: Date,
): CataloguePreparingVM {
  const online = sale.previewStartTime ?? sale.startTime;
  const onlineDate = online ? new Date(online) : null;
  const deadline = sale.consignmentDeadline ? new Date(sale.consignmentDeadline) : null;

  const sentences: string[] = [];
  sentences.push(
    onlineDate && onlineDate.getTime() > now.getTime()
      ? `Lots go online from ${formatLondonWeekdayDate(onlineDate, now)}.`
      : "Lots will appear here as soon as they are published.",
  );
  if (deadline && deadline.getTime() > now.getTime()) {
    sentences.push(
      `Consignments for this sale are open until ${formatLondonWeekdayDate(deadline, now)}.`,
    );
  }
  return { title: "The catalogue is being prepared", description: sentences.join(" ") };
}
