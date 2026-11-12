import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";

/**
 * The line under a purchase's title: the lot, the sale, the day and who in the account bought it.
 * A lot bought by accepting an offer after the auction was not won at its sale, so it says when it
 * was bought and by whom, never "won".
 */
export function purchaseSubtitle(input: {
  lotLabel: string | null;
  saleTitle: string | null;
  endedAt: Date;
  /** When the offer after the auction was accepted, for a lot bought that way. */
  boughtOn: string | null;
  /** The member who won or bought it, when the account has more than one. */
  buyer: string | null;
}): string {
  const { boughtOn, buyer } = input;
  const dated = boughtOn
    ? `Bought after the auction at your bid · ${formatDate(new Date(boughtOn), LONDON_TIME_ZONE)}`
    : formatDate(input.endedAt, LONDON_TIME_ZONE);
  const who = buyer ? `${boughtOn ? "bought" : "won"} by ${buyer}` : null;
  return [input.lotLabel, input.saleTitle, dated, who].filter(Boolean).join(" · ");
}
