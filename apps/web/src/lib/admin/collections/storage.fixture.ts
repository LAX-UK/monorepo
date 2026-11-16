import type { StaffStorageSettings, StaffStorageTerms } from "@auction/types";

/** A place's storage as the Storage tab reads it, for tests and the e2e screens. */
export const STORAGE_VENUE = "d0000000-0000-4000-8000-0000000000aa";
export const STORAGE_TODAY = "2026-11-15";

export const STORAGE_IN_FORCE: StaffStorageTerms = {
  id: "d0000000-0000-4000-8000-0000000000c0",
  effectiveFrom: "2026-11-01",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  reason: "First terms, approved 1 Nov",
};

export const STORAGE_SCHEDULED: StaffStorageTerms = {
  id: "d0000000-0000-4000-8000-0000000000c1",
  effectiveFrom: "2026-12-01",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
  reason: "Rates for 2027, agreed with the gallery",
};

export const STORAGE: StaffStorageSettings = {
  venueId: STORAGE_VENUE,
  today: STORAGE_TODAY,
  inForce: STORAGE_IN_FORCE,
  scheduled: null,
  charging: { raiseInvoices: false, vatTreatment: null },
  history: [
    {
      id: "h2",
      at: "2026-11-01T09:30:00.000Z",
      action: "terms_scheduled",
      who: "Fran Okafor",
      before: null,
      after: {
        effectiveFrom: "2026-11-01",
        freeDays: 14,
        countMode: "calendar",
        standardDailyPence: 300,
        largeDailyPence: 600,
        handlingFeePence: 0,
      },
      reason: "First terms, approved 1 Nov",
    },
    {
      id: "h1",
      at: "2026-10-20T08:00:00.000Z",
      action: "terms_migrated",
      who: null,
      before: { freeStorageDays: 30 },
      after: { freeDays: 30, effectiveFrom: "2026-10-20" },
      reason: "Moved from the free storage days setting in Hours and rules",
    },
  ],
};

export const STORAGE_WITH_CHANGE: StaffStorageSettings = {
  ...STORAGE,
  scheduled: STORAGE_SCHEDULED,
  history: [
    {
      id: "h3",
      at: "2026-11-14T15:10:00.000Z",
      action: "terms_scheduled",
      who: "Fran Okafor",
      before: null,
      after: { ...STORAGE_SCHEDULED },
      reason: STORAGE_SCHEDULED.reason,
    },
    ...STORAGE.history,
  ],
};

export const STORAGE_EMPTY: StaffStorageSettings = {
  ...STORAGE,
  inForce: null,
  scheduled: null,
  history: [],
};
