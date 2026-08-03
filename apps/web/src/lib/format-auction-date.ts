import type { Lot, Sale } from "@auction/types";

const london: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** Hero / meta line: closing focus for a live lot. */
export function formatLotAuctionLine(lot: Lot): string {
  const end = lot.endTime.toLocaleString("en-GB", {
    ...london,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Closes ${end} · London`;
}

/** Sale card subtitle: "9–16 April 2026 | London" style range when possible. */
export function formatSaleDateRange(sale: Pick<Sale, "startTime" | "endTime">): string {
  const sameMonth =
    sale.startTime.getMonth() === sale.endTime.getMonth() &&
    sale.startTime.getFullYear() === sale.endTime.getFullYear();
  if (sameMonth) {
    const month = sale.endTime.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      month: "long",
    });
    const year = sale.endTime.getFullYear();
    const d0 = sale.startTime.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
    });
    const d1 = sale.endTime.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric" });
    return `${d0}–${d1} ${month} ${year}`;
  }
  const a = sale.startTime.toLocaleString("en-GB", london);
  const b = sale.endTime.toLocaleString("en-GB", london);
  return `${a} – ${b}`;
}
