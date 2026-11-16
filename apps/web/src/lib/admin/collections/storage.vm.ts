import {
  LARGE_WORK_SIDE_CM,
  MAX_STORAGE_AMOUNT_PENCE,
  MAX_STORAGE_FREE_DAYS,
  type StorageTerms,
  formatStorageTerms,
  latestStorageTermsStart,
} from "@auction/domain";
import { type ChangesRow, formatGbp, formatStaffCalendarDay } from "@auction/staff-ui";
import type {
  StaffStorageCountMode,
  StaffStorageHistoryEntry,
  StaffStorageTerms,
} from "@auction/types";
import type { StorageTermsBody } from "@auction/validators";
import { STORAGE_COPY } from "./storage-copy";

const C = STORAGE_COPY;

/** The day as staff read it: "Tue 1 Dec", with the year when it is not this one. */
export const storageDay = (day: string, today: string): string =>
  formatStaffCalendarDay(day, new Date(`${today}T12:00:00Z`));

const money = (pence: number): string => formatGbp(pence);

/* ---- The Schedule a change form ----------------------------------------------------------- */

/** A money field as typed: its pence, and whether it was left empty (not the same as invalid). */
export type AmountDraft = { pence: number | null; empty: boolean };

export type StorageDraft = {
  effectiveFrom: string | null;
  reason: string;
  freeDays: string;
  countMode: StaffStorageCountMode;
  standard: AmountDraft;
  largeOn: boolean;
  large: AmountDraft;
  handling: AmountDraft;
};

export type StorageField =
  | "effectiveFrom"
  | "reason"
  | "freeDays"
  | "standard"
  | "large"
  | "handling";

/** Order of the fields on the form, so the error summary lists them top to bottom. */
export const STORAGE_FIELDS: readonly StorageField[] = [
  "effectiveFrom",
  "reason",
  "freeDays",
  "standard",
  "large",
  "handling",
];

export type StorageErrors = Partial<Record<StorageField, string>>;

const amount = (pence: number | null): AmountDraft => ({ pence, empty: pence === null });

/** The design's defaults (docs/design/storage-terms.md) for a place's first terms. */
const FIRST_TERMS = {
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
} as const;

/**
 * A new change starts from the terms in force (or the design's defaults for a place with none),
 * so staff change only what moves. The start date and reason are always asked for. Editing the
 * scheduled change starts from it, reason included.
 */
export function draftFromTerms(
  terms: Omit<StaffStorageTerms, "id" | "effectiveFrom" | "reason"> | null,
  scheduled?: Pick<StaffStorageTerms, "effectiveFrom" | "reason">,
): StorageDraft {
  const values = terms ?? FIRST_TERMS;
  return {
    effectiveFrom: scheduled?.effectiveFrom ?? null,
    reason: scheduled?.reason ?? "",
    freeDays: String(values.freeDays),
    countMode: values.countMode,
    standard: amount(values.standardDailyPence),
    largeOn: values.largeDailyPence !== null,
    large: amount(values.largeDailyPence),
    handling: amount(values.handlingFeePence === 0 ? null : values.handlingFeePence),
  };
}

const WHOLE = /^\d+$/;

function freeDaysOf(text: string): number | null {
  const trimmed = text.trim();
  if (!WHOLE.test(trimmed)) return null;
  const days = Number(trimmed);
  return days <= MAX_STORAGE_FREE_DAYS ? days : null;
}

const inRange = (pence: number | null): pence is number =>
  pence !== null && Number.isInteger(pence) && pence >= 0 && pence <= MAX_STORAGE_AMOUNT_PENCE;

/** The handling fee is optional: left empty, it is none. Typed, it must be an amount. */
const handlingOf = (handling: AmountDraft): number | null =>
  handling.empty ? 0 : inRange(handling.pence) ? handling.pence : null;

/** A large band that is on charges at least 1p: "or £0.00 for large works" is never shown. */
const largeInRange = (pence: number | null): pence is number => inRange(pence) && pence > 0;

/** The latest start a change made on `today` may have, as staff read it: "Wed 15 Nov 2028". */
export const latestStartDay = (today: string): string =>
  storageDay(latestStorageTermsStart(today), today);

/** Each field's problem, in the words the design gives. `today` is the London day. */
export function validateStorageDraft(draft: StorageDraft, today: string): StorageErrors {
  const errors: StorageErrors = {};
  if (!draft.effectiveFrom || draft.effectiveFrom <= today) {
    errors.effectiveFrom = C.errors.startsOn;
  } else if (draft.effectiveFrom > latestStorageTermsStart(today)) {
    errors.effectiveFrom = C.errors.startsTooLate(latestStartDay(today));
  }
  if (draft.reason.trim() === "") errors.reason = C.errors.reason;
  if (freeDaysOf(draft.freeDays) === null) errors.freeDays = C.errors.freeDays;
  if (!inRange(draft.standard.pence)) errors.standard = C.errors.amount;
  if (draft.largeOn && !largeInRange(draft.large.pence)) {
    errors.large = draft.large.empty || draft.large.pence === 0 ? C.errors.large : C.errors.amount;
  }
  if (handlingOf(draft.handling) === null) errors.handling = C.errors.amount;
  return errors;
}

/** The terms the draft describes, or null while a value the preview needs is missing. */
export function termsFromDraft(draft: StorageDraft): StorageTerms | null {
  const freeDays = freeDaysOf(draft.freeDays);
  const handling = handlingOf(draft.handling);
  if (freeDays === null || !inRange(draft.standard.pence) || handling === null) return null;
  if (draft.largeOn && !largeInRange(draft.large.pence)) return null;
  return {
    freeDays,
    countMode: draft.countMode,
    standardDailyPence: draft.standard.pence,
    largeDailyPence: draft.largeOn ? draft.large.pence : null,
    handlingFeePence: handling,
    effectiveFrom: draft.effectiveFrom ?? "",
  };
}

/** "Buyers will read": the same sentence the lot and shipping pages print, from the domain. */
export function buyerPreview(draft: StorageDraft): string | null {
  const terms = termsFromDraft(draft);
  return terms ? formatStorageTerms(terms) : null;
}

/** The request body for a valid draft. Call after `validateStorageDraft` finds nothing. */
export function bodyFromDraft(draft: StorageDraft): StorageTermsBody {
  const terms = termsFromDraft(draft);
  if (!terms || !draft.effectiveFrom) throw new Error("The storage terms are not complete");
  return {
    effectiveFrom: draft.effectiveFrom,
    reason: draft.reason.trim(),
    freeDays: terms.freeDays,
    countMode: terms.countMode,
    standardDailyPence: terms.standardDailyPence,
    largeDailyPence: terms.largeDailyPence,
    handlingFeePence: terms.handlingFeePence,
  };
}

/** Whether the form differs from where it started, for the unsaved-changes guard. */
export function isStorageDraftDirty(draft: StorageDraft, initial: StorageDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

/* ---- The cards ------------------------------------------------------------------------------ */

type TermsValues = Omit<StaffStorageTerms, "id" | "reason">;

/** The "In force" card's facts, label then value. */
export function termsFacts(terms: TermsValues): { label: string; value: string }[] {
  return [
    {
      label: C.labels.freeStorage,
      value: C.values.freeStorage(terms.freeDays, terms.countMode === "working"),
    },
    { label: C.labels.standard, value: C.values.perLot(money(terms.standardDailyPence)) },
    {
      label: C.labels.large,
      value:
        terms.largeDailyPence === null
          ? C.values.largeOff
          : C.values.largeOn(money(terms.largeDailyPence), LARGE_WORK_SIDE_CM),
    },
    {
      label: C.labels.handling,
      value:
        terms.handlingFeePence === 0
          ? C.values.handlingNone
          : C.values.handling(money(terms.handlingFeePence)),
    },
    { label: C.labels.appliesTo, value: C.values.appliesTo },
  ];
}

const freeText = (terms: TermsValues) =>
  C.sentences.summary.free(terms.freeDays, terms.countMode === "working");

/** The scheduled change beside the terms in force, value by value; changed rows stand out. */
export function scheduledChanges(
  inForce: TermsValues | null,
  scheduled: TermsValues,
): ChangesRow[] {
  const row = (id: string, label: string, after: string, before: string | null): ChangesRow => ({
    id,
    label,
    before,
    after,
    changes: before !== after,
  });
  const large = (t: TermsValues) =>
    t.largeDailyPence === null ? C.values.largeOff : money(t.largeDailyPence);
  const handling = (t: TermsValues) =>
    t.handlingFeePence === 0 ? C.values.handlingNone : money(t.handlingFeePence);
  // The start date is the card's own heading ("From Tue 1 Dec"), so it is not a row: it would
  // always read as changed.
  const L = C.changeLabels;
  return [
    row("free", L.freeStorage, freeText(scheduled), inForce ? freeText(inForce) : null),
    row(
      "standard",
      L.standard,
      money(scheduled.standardDailyPence),
      inForce ? money(inForce.standardDailyPence) : null,
    ),
    row("large", L.large, large(scheduled), inForce ? large(inForce) : null),
    row("handling", L.handling, handling(scheduled), inForce ? handling(inForce) : null),
  ];
}

/* ---- History -------------------------------------------------------------------------------- */

type Values = Record<string, unknown>;

const num = (values: Values | null, key: string): number | null => {
  const value = values?.[key];
  return typeof value === "number" ? value : null;
};
const text = (values: Values | null, key: string): string | null => {
  const value = values?.[key];
  return typeof value === "string" ? value : null;
};

/** One value of a version as the History sentence says it. */
function sayValue(key: string, values: Values | null, today: string): string {
  const S = C.sentences;
  switch (key) {
    case "effectiveFrom": {
      const day = text(values, key);
      return day ? storageDay(day, today) : S.none;
    }
    case "freeDays":
      return String(num(values, key) ?? 0);
    case "countMode":
      return text(values, key) === "working" ? S.countModes.working : S.countModes.calendar;
    case "largeDailyPence": {
      const pence = num(values, key);
      return pence === null ? S.off : money(pence);
    }
    case "handlingFeePence": {
      const pence = num(values, key) ?? 0;
      return pence === 0 ? S.none : money(pence);
    }
    default:
      return money(num(values, key) ?? 0);
  }
}

function summary(values: Values | null): string {
  const S = C.sentences.summary;
  const large = num(values, "largeDailyPence");
  const handling = num(values, "handlingFeePence") ?? 0;
  return [
    S.free(num(values, "freeDays") ?? 0, text(values, "countMode") === "working"),
    S.standard(money(num(values, "standardDailyPence") ?? 0)),
    large === null ? S.largeOff : S.large(money(large)),
    handling === 0 ? S.handlingNone : S.handling(money(handling)),
  ].join(", ");
}

const FIELD_ORDER = Object.keys(C.sentences.fields) as (keyof typeof C.sentences.fields)[];

/** The History row's "Change": what happened, as one plain sentence. */
export function historySentence(entry: StaffStorageHistoryEntry, today: string): string {
  const S = C.sentences;
  const startOf = (values: Values | null) => {
    const day = text(values, "effectiveFrom");
    return day ? storageDay(day, today) : S.none;
  };
  switch (entry.action) {
    case "terms_scheduled":
      return S.scheduled(startOf(entry.after), summary(entry.after));
    case "terms_edited": {
      const changed = FIELD_ORDER.filter((key) => entry.before?.[key] !== entry.after?.[key]);
      if (changed.length === 0) return S.editedNothing(startOf(entry.after));
      return S.edited(
        startOf(entry.before),
        changed
          .map((key) =>
            S.from(
              S.fields[key],
              sayValue(key, entry.before, today),
              sayValue(key, entry.after, today),
            ),
          )
          .join("; "),
      );
    }
    case "terms_cancelled":
      return S.cancelled(startOf(entry.before));
    case "charging_switched":
      return entry.after?.raiseInvoices === true ? S.chargingOn : S.chargingOff;
    case "vat_treatment_set": {
      const treatment = text(entry.after, "vatTreatment") as keyof typeof C.vatTreatments | null;
      return S.vat(treatment ? C.vatTreatments[treatment] : S.none);
    }
    case "terms_migrated":
      return S.migrated(num(entry.before, "freeStorageDays") ?? num(entry.after, "freeDays") ?? 0);
  }
}
