/**
 * The words of the Not collected tab's lots past their collect-by day, and the two reason dialogs
 * that act on them (docs/design/storage-terms.md, "Not collected tab"). Money is formatted by the
 * domain storage formatter (`formatStoragePence`, in the view model); this file holds only staff
 * wording, and its day counts come from the domain constants so they cannot drift.
 */
import { MAX_STORAGE_EXTENSION_DAYS, STORAGE_FOLLOW_UP_DAYS } from "@auction/domain";

export const NOT_COLLECTED_COPY = {
  section: {
    title: "Past collect-by",
    description:
      "Works still here after their collect-by day, longest over first. Storage counts from the day after.",
    count: (n: number, atLeast = false) =>
      `${atLeast ? "At least " : ""}${n} ${n === 1 ? "lot" : "lots"} past collect-by`,
    /** The title of the notice when the list is cut: the true total, then how many are shown. */
    moreTitle: (total: number, shown: number, atLeast = false) =>
      `${atLeast ? "At least " : ""}${total} lots past collect-by, showing the ${shown} longest over`,
    more: "Showing the longest over. More lots are past their day; they appear as these are collected.",
  },
  visitsTitle: "Missed visits",
  chargingOff: {
    title: "Charging is off",
    body: "Storage so far is what would be due under the terms. No storage invoice is raised and buyers are not billed.",
  },
  empty: {
    title: "No lots past their collect-by day",
    body: "Works that stay after their free storage ends appear here, with what their storage comes to.",
  },
  loadError: {
    title: "The lots past collect-by didn't load",
    body: "We couldn't load them. Try again in a moment.",
    action: "Try again",
  },
  readOnly: "Extending free storage is for Fulfilment, and waiving charges for Finance.",
  row: {
    daysOver: (n: number) => `${n} ${n === 1 ? "day" : "days"} over`,
    collectBy: (day: string, buyer: string) => `Collect by ${day} · ${buyer}`,
    storageLabel: "Storage so far",
    bandLabel: "Band",
    band: { standard: "Standard", large: "Large" },
    followUp: "Follow up",
    followUpHint: `${STORAGE_FOLLOW_UP_DAYS} days or more past collect-by. Contact the buyer in person.`,
    waived: "Charges waived",
    waivedBadge: "Waived",
    legacy: "Won before storage terms: nothing is charged.",
    nothingOwed: "Nothing owed",
    extended: (days: number) => `Extended by ${days} ${days === 1 ? "day" : "days"}`,
    lotLine: (lotNumber: number | null, title: string) =>
      lotNumber != null ? `Lot ${lotNumber} · ${title}` : title,
  },
  actions: {
    extend: "Extend free storage",
    waive: "Waive charges",
    extendCapped: `This lot has had the most free days it can: ${MAX_STORAGE_EXTENSION_DAYS}.`,
  },
  extend: {
    title: "Extend free storage",
    description: (lot: string) => `${lot}. The buyer's page updates at once.`,
    daysLabel: "Days to add",
    daysHint: (max: number) =>
      `From 1 to ${max}. All extensions on a lot stop at ${MAX_STORAGE_EXTENSION_DAYS} days.`,
    reasonLabel: "Reason",
    reasonHint: "Kept in the lot's storage history with your name.",
    effect: (days: number) =>
      `Adds ${days} free ${days === 1 ? "day" : "days"} to the collect-by day. No storage is charged for them.`,
    submit: "Extend free storage",
    cancel: "Cancel",
    dirtyLabel: "the extension",
    toast: (lot: string) => `Free storage extended for ${lot}`,
  },
  waive: {
    title: "Waive storage charges",
    description: (lot: string) => `${lot}. The buyer's page updates at once.`,
    reasonLabel: "Reason",
    reasonHint: "Kept in the lot's storage history with your name.",
    effect: (amount: string, chargingOn: boolean) =>
      chargingOn
        ? `${amount} so far will not be charged, and no more storage will build up on this lot. This can't be undone here.`
        : `${amount} so far is what would be due. Nothing is charged while charging is off; if it is switched on, this lot will not be charged, and no more storage will build up on it. This can't be undone here.`,
    submit: "Waive charges",
    cancel: "Cancel",
    dirtyLabel: "the waiver",
    toast: (lot: string) => `Storage charges waived for ${lot}`,
  },
  errors: {
    days: (max: number) => `Enter a whole number of days from 1 to ${max}`,
    reason: "Enter a reason",
    reasonTooLong: "Enter a reason of 500 characters or fewer",
  },
  summaryTitle: (count: number) => `${count} ${count === 1 ? "thing" : "things"} to fix`,
  failed: "Nothing was changed",
} as const;
