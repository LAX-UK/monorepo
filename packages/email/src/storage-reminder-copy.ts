/**
 * The words of the storage reminders a buyer is sent about works they have neither booked nor
 * collected (docs/design/storage-terms.md, ST15): a week before the collect-by day and on it, one
 * email the day after, then a running total every 14 days. The figures (rates, running totals) come
 * from the domain formatter that writes the buyer's purchase page; only the sentences around them
 * are here, so a change to them is made in one place, and in the design document with it.
 *
 * Rules these emails keep:
 * - while a place raises no storage invoices, no email before or on the day says storage "is
 *   charged" (the rate may still be listed under each work), and the email after the day says only the approved
 *   "storage charges may apply" wording, and no running total is sent: nothing is billed;
 * - nothing is said about selling or disposing of a work (ST16).
 */

export type StorageEmailCopy = {
  subject: string;
  /** The inbox preview line. */
  preview: string;
  /** The heading inside the email. */
  title: string;
  /** Paragraphs before the list of works. */
  paragraphs: string[];
};

const lotWord = (count: number) => (count === 1 ? "lot" : "lots");

/** The reminder a week before the collect-by day (`lead`) and on it (`day`). */
export function collectByReminderCopy(input: {
  when: "lead" | "day";
  collectByLabel: string;
  placeName: string;
  lotCount: number;
  /** At least one of the works has a rate after the day: its rate is listed under it. */
  withRates: boolean;
  /**
   * "Raise storage invoices" is on for the place. Only then do the sentences say storage "is
   * charged"; while it is off, nothing is billed and the approved "may apply" wording stays.
   */
  chargingOn: boolean;
}): StorageEmailCopy {
  const { when, collectByLabel, placeName, lotCount, withRates, chargingOn } = input;
  const charged = withRates && chargingOn;
  if (when === "day") {
    return {
      subject: "Your free storage ends today",
      preview: "Your free storage ends today.",
      title: "Your free storage ends today",
      paragraphs: [
        `Today is the last day of free storage for your ${lotWord(lotCount)} at ${placeName}. Book the next available time to come in. ${
          charged
            ? "From tomorrow, storage is charged at the daily rate shown below, under our storage policy."
            : "Storage charges may apply from tomorrow under our storage policy."
        }`,
      ],
    };
  }
  return {
    subject: `Please collect by ${collectByLabel}`,
    preview: `Please collect by ${collectByLabel}.`,
    title: `Please collect by ${collectByLabel}`,
    paragraphs: [
      `Your ${lotCount === 1 ? "lot stays" : "lots stay"} with us at ${placeName}. Please collect by ${collectByLabel}. ${
        charged
          ? "After that, storage is charged at the daily rate shown below, under our storage policy."
          : "After that, storage charges may apply under our storage policy."
      }`,
    ],
  };
}

/**
 * The email the day after the collect-by day (`started`) and each running total after it
 * (`total`). `chargingOn` false: the place raises no storage invoices, so the approved charging-off
 * wording only, and a subject that does not say charges have started.
 */
export function storageChargesCopy(input: {
  kind: "started" | "total";
  chargingOn: boolean;
  collectByLabel: string;
  placeName: string;
  lotCount: number;
}): StorageEmailCopy {
  const { kind, chargingOn, collectByLabel, placeName, lotCount } = input;
  const book = "Book a time to collect, and you will pay the storage up to that day when you book.";
  if (!chargingOn) {
    return {
      subject: "Your free storage has ended",
      preview: `Please collect by ${collectByLabel}.`,
      title: `Please collect by ${collectByLabel}`,
      paragraphs: [
        `That day has passed, so storage charges may apply. Book a time to collect your work from ${placeName}, or email us if you need longer.`,
      ],
    };
  }
  if (kind === "started") {
    return {
      subject: "Storage charges have started",
      preview: "Storage charges have started.",
      title: "Storage charges have started",
      paragraphs: [
        `Free storage for your ${lotWord(lotCount)} at ${placeName} ended on ${collectByLabel}, so storage charges have started. ${book}`,
      ],
    };
  }
  return {
    subject: "Your storage charges so far",
    preview: "Your storage charges so far.",
    title: "Your storage charges so far",
    paragraphs: [
      `Your ${lotCount === 1 ? "lot is" : "lots are"} still with us at ${placeName}, and storage has been charged since free storage ended on ${collectByLabel}. ${book}`,
    ],
  };
}
