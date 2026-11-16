import { formatStaffDate } from "@auction/staff-ui";
import type { StaffOverdueLot } from "@auction/types";
import { NOT_COLLECTED_COPY as C } from "./not-collected-copy";

/** A London day key as a date to format; noon keeps it on the same day in any zone. */
const dayDate = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** "£42.00": whole pence as staff read them. */
export function formatPence(pence: number): string {
  const pounds = Math.floor(pence / 100).toLocaleString("en-GB");
  return `£${pounds}.${String(pence % 100).padStart(2, "0")}`;
}

/** What one row of the list shows. */
export type OverdueRowView = {
  lotId: string;
  lotLine: string;
  daysOver: string;
  collectBy: string;
  band: string;
  /** "£42.00", or the reason nothing is owed. */
  storage: string;
  /** The running total sentence, when there is one. */
  storageDetail: string | null;
  followUp: boolean;
  waived: boolean;
  extendedNote: string | null;
  /** Why Extend cannot be used on this lot; `null` when it can. */
  extendBlocked: string | null;
  /** Waive is offered: there is something to waive and it is not already waived. */
  canWaive: boolean;
};

export function overdueRowView(lot: StaffOverdueLot, now: Date = new Date()): OverdueRowView {
  const storage = lot.waived
    ? C.row.waived
    : lot.legacyTerms
      ? C.row.legacy
      : lot.amountPence > 0
        ? formatPence(lot.amountPence)
        : C.row.nothingOwed;
  return {
    lotId: lot.lotId,
    lotLine: C.row.lotLine(lot.lotNumber, lot.title),
    daysOver: C.row.daysOver(lot.daysOver),
    collectBy: C.row.collectBy(formatStaffDate(dayDate(lot.collectBy), now), lot.buyerName),
    band: C.row.band[lot.band],
    storage,
    storageDetail: lot.waived || lot.amountPence === 0 ? null : lot.amountDetail,
    followUp: lot.followUp,
    waived: lot.waived,
    extendedNote: lot.extensionDays > 0 ? C.row.extended(lot.extensionDays) : null,
    extendBlocked: lot.extensionDaysLeft <= 0 ? C.actions.extendCapped : null,
    canWaive: !lot.waived && !lot.legacyTerms && lot.amountPence > 0,
  };
}

export type ExtendDraft = { days: string; reason: string };
export type ExtendField = keyof ExtendDraft;
export const EXTEND_FIELDS: readonly ExtendField[] = ["days", "reason"];
export type ExtendErrors = Partial<Record<ExtendField, string>>;

const REASON_MAX = 500;

function reasonError(reason: string): string | undefined {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return C.errors.reason;
  if (trimmed.length > REASON_MAX) return C.errors.reasonTooLong;
  return undefined;
}

/** Whole days from 1 to what the lot has left; `null` when the text is not such a number. */
export function parseExtensionDays(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= 1 && days <= max ? days : null;
}

export function validateExtendDraft(draft: ExtendDraft, max: number): ExtendErrors {
  const errors: ExtendErrors = {};
  if (parseExtensionDays(draft.days, max) === null) errors.days = C.errors.days(max);
  const reason = reasonError(draft.reason);
  if (reason) errors.reason = reason;
  return errors;
}

export function validateWaiveReason(reason: string): string | undefined {
  return reasonError(reason);
}
