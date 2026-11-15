import { MAX_LOTS_PER_COLLECTION } from "@auction/domain";

const lots = (count: number) => `${count} ${count === 1 ? "lot" : "lots"}`;
const invoices = (count: number) => `${count} ${count === 1 ? "invoice" : "invoices"}`;

/** "A", "A and B", "A, B and C". */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The collection words the purchases list draws: the row badges and the bar that books several
 * lots in one visit. Kept apart from `COLLECT_COPY` (which spreads them in) so the list's client
 * bundle carries these sentences and not every sentence of the booking pages.
 */
export const COLLECT_LIST_COPY = {
  badge: {
    booked: (day: string) => `Booked ${day}`,
    collectBy: (day: string) => `Collect by ${day}`,
    overdue: (day: string) => `Overdue since ${day}`,
    /** The badge's whole sentence, read by assistive technology. */
    bookedSentence: (day: string) => `Collection booked for ${day}.`,
    collectBySentence: (day: string) => `Please collect by ${day}.`,
    overdueSentence: (day: string) => `Collection overdue since ${day}. Storage charges may apply.`,
  },
  bulk: {
    button: (count: number) => `Book a collection time for ${lots(count)}`,
    /** The action while the picked lots cannot share one visit. */
    unavailable: "Book a collection time",
    selected: (count: number, place: string) => `${lots(count)} at ${place}, in one visit`,
    /** `places` are the distinct names; two places can share one. */
    mixed: (places: readonly string[]) =>
      places.length > 1
        ? `These lots wait at ${listOf(places)}. Pick lots from one place to book them together.`
        : `These lots wait at different places called ${places[0] ?? ""}. Pick lots from one place to book them together.`,
    tooMany: `A visit holds up to ${MAX_LOTS_PER_COLLECTION} lots. Pick fewer, or book in two visits.`,
    pick: (title: string) => `Add ${title} to a collection visit`,
    /** Said to assistive technology when a pick of one kind lets go of the other. */
    clearedPay: (count: number) =>
      `${invoices(count)} picked to pay ${count === 1 ? "was" : "were"} unpicked. Pay and collect one at a time.`,
    clearedCollect: (count: number) =>
      `${lots(count)} picked to collect ${count === 1 ? "was" : "were"} unpicked. Pay and collect one at a time.`,
  },
} as const;
