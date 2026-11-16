import type { StaffStorageHistoryEntry, StaffStorageTerms } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type StorageDraft,
  bodyFromDraft,
  buyerPreview,
  draftFromTerms,
  historySentence,
  isStorageDraftDirty,
  scheduledChanges,
  termsFacts,
  validateStorageDraft,
} from "./storage.vm";

const TODAY = "2026-11-15";

const IN_FORCE: StaffStorageTerms = {
  id: "t1",
  effectiveFrom: "2026-11-01",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  reason: "First terms",
};

const valid = (over: Partial<StorageDraft> = {}): StorageDraft => ({
  ...draftFromTerms(IN_FORCE),
  effectiveFrom: "2026-12-01",
  reason: "New rates",
  ...over,
});

const entry = (over: Partial<StaffStorageHistoryEntry>): StaffStorageHistoryEntry => ({
  id: "h1",
  at: "2026-11-15T10:00:00.000Z",
  action: "terms_scheduled",
  who: "Fran Finance",
  before: null,
  after: null,
  reason: null,
  ...over,
});

describe("the change form's starting values", () => {
  it("starts from the terms in force, asking for a date and a reason", () => {
    expect(draftFromTerms(IN_FORCE)).toEqual({
      effectiveFrom: null,
      reason: "",
      freeDays: "14",
      countMode: "calendar",
      standard: { pence: 300, empty: false },
      largeOn: true,
      large: { pence: 600, empty: false },
      handling: { pence: null, empty: true },
    });
  });

  it("starts from the design's defaults for a place with no terms", () => {
    expect(draftFromTerms(null)).toMatchObject({
      freeDays: "14",
      countMode: "calendar",
      standard: { pence: 300 },
      large: { pence: 600 },
    });
  });

  it("starts an edit from the scheduled change, its date and reason included", () => {
    expect(
      draftFromTerms(
        { ...IN_FORCE, largeDailyPence: null, handlingFeePence: 500 },
        { effectiveFrom: "2026-12-01", reason: "Winter" },
      ),
    ).toMatchObject({
      effectiveFrom: "2026-12-01",
      reason: "Winter",
      largeOn: false,
      handling: { pence: 500, empty: false },
    });
  });
});

describe("validating the change", () => {
  it("accepts a complete change", () => {
    expect(validateStorageDraft(valid(), TODAY)).toEqual({});
  });

  it("names every field at fault in the design's words", () => {
    expect(
      validateStorageDraft(
        valid({
          effectiveFrom: TODAY,
          reason: " ",
          freeDays: "91",
          standard: { pence: null, empty: true },
          large: { pence: null, empty: true },
          handling: { pence: null, empty: false },
        }),
        TODAY,
      ),
    ).toEqual({
      effectiveFrom: "Choose a date from tomorrow",
      reason: "Enter a reason",
      freeDays: "Enter a number of days from 0 to 90",
      standard: "Enter an amount up to £500.00",
      large: "Enter a daily rate, or turn off the large band",
      handling: "Enter an amount up to £500.00",
    });
  });

  it.each(["", "-1", "1.5", "abc", "91"])("refuses %j free days", (freeDays) => {
    expect(validateStorageDraft(valid({ freeDays }), TODAY).freeDays).toBeDefined();
  });

  it("accepts 0 and 90 free days, and tomorrow", () => {
    expect(
      validateStorageDraft(valid({ freeDays: "0", effectiveFrom: "2026-11-16" }), TODAY),
    ).toEqual({});
    expect(validateStorageDraft(valid({ freeDays: "90" }), TODAY)).toEqual({});
  });

  it("refuses amounts over £500.00 and a large rate that is not an amount", () => {
    expect(
      validateStorageDraft(valid({ standard: { pence: 50_001, empty: false } }), TODAY),
    ).toEqual({
      standard: "Enter an amount up to £500.00",
    });
    expect(validateStorageDraft(valid({ large: { pence: null, empty: false } }), TODAY)).toEqual({
      large: "Enter an amount up to £500.00",
    });
  });

  it("refuses a large band of £0.00: it is turned off instead", () => {
    expect(validateStorageDraft(valid({ large: { pence: 0, empty: false } }), TODAY)).toEqual({
      large: "Enter a daily rate, or turn off the large band",
    });
    expect(buyerPreview(valid({ large: { pence: 0, empty: false } }))).toBeNull();
  });

  it("refuses a start more than 2 years ahead, naming the latest day", () => {
    expect(validateStorageDraft(valid({ effectiveFrom: "2028-11-16" }), TODAY)).toEqual({
      effectiveFrom: "Choose a date up to Wed 15 Nov 2028",
    });
    expect(validateStorageDraft(valid({ effectiveFrom: "2028-11-15" }), TODAY)).toEqual({});
  });

  it("does not ask for a large rate while the band is off", () => {
    expect(
      validateStorageDraft(valid({ largeOn: false, large: { pence: null, empty: true } }), TODAY),
    ).toEqual({});
  });
});

describe("what is sent", () => {
  it("sends pence, the large band off as null, and an empty handling fee as none", () => {
    expect(bodyFromDraft(valid({ largeOn: false, reason: "  Winter  " }))).toEqual({
      effectiveFrom: "2026-12-01",
      reason: "Winter",
      freeDays: 14,
      countMode: "calendar",
      standardDailyPence: 300,
      largeDailyPence: null,
      handlingFeePence: 0,
    });
  });

  it("knows when the form has changed", () => {
    const initial = draftFromTerms(IN_FORCE);
    expect(isStorageDraftDirty(initial, draftFromTerms(IN_FORCE))).toBe(false);
    expect(isStorageDraftDirty({ ...initial, reason: "x" }, initial)).toBe(true);
  });
});

describe("Buyers will read", () => {
  it("is the domain's buyer sentence for the values typed", () => {
    expect(
      buyerPreview(
        valid({ standard: { pence: 350, empty: false }, large: { pence: 700, empty: false } }),
      ),
    ).toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3.50 a day for each work, or £7.00 for works over 150 cm on any side, plus VAT where it applies.",
    );
  });

  it("waits until the values it needs are there", () => {
    expect(buyerPreview(valid({ freeDays: "" }))).toBeNull();
    expect(buyerPreview(valid({ largeOn: true, large: { pence: null, empty: true } }))).toBeNull();
  });
});

describe("the cards", () => {
  it("lists the terms in force as the design writes them", () => {
    expect(termsFacts(IN_FORCE)).toEqual([
      {
        label: "Free",
        value:
          "14 days after payment clears. A date that falls on a closed day moves to the next open day.",
      },
      { label: "Counting", value: "Calendar days" },
      { label: "Standard", value: "£3.00 per lot a day" },
      {
        label: "Large",
        value: "£6.00 per lot a day · any side over 150 cm, marked on the lot",
      },
      { label: "Handling", value: "None" },
      { label: "Applies to", value: "Lots won in sales that close on or after the start date" },
    ]);
  });

  it("puts the scheduled change beside the terms in force, marking what changes", () => {
    const rows = scheduledChanges(IN_FORCE, {
      ...IN_FORCE,
      effectiveFrom: "2026-12-01",
      standardDailyPence: 350,
    });
    expect(rows.map((row) => [row.label, row.before, row.after, row.changes])).toEqual([
      ["Free", "14 days", "14 days", false],
      ["Counting", "Calendar days", "Calendar days", false],
      ["Standard", "£3.00", "£3.50", true],
      ["Large", "£6.00", "£6.00", false],
      ["Handling", "None", "None", false],
    ]);
  });

  it("uses the In force list's labels, with short values that fit a phone", () => {
    const rows = scheduledChanges(IN_FORCE, {
      ...IN_FORCE,
      freeDays: 0,
      countMode: "working",
      largeDailyPence: null,
    });
    const facts = termsFacts(IN_FORCE).map((fact) => fact.label);
    for (const row of rows) expect(facts).toContain(row.label);
    expect(rows.map((row) => [row.label, row.after])).toEqual([
      ["Free", "None"],
      ["Counting", "Working days"],
      ["Standard", "£3.00"],
      ["Large", "As standard"],
      ["Handling", "None"],
    ]);
    expect(scheduledChanges(IN_FORCE, { ...IN_FORCE, freeDays: 1 })[0]?.after).toBe("1 day");
  });

  it("shows every value as new for a place's first terms", () => {
    expect(scheduledChanges(null, IN_FORCE).every((row) => row.changes)).toBe(true);
  });
});

describe("History sentences", () => {
  const after = {
    effectiveFrom: "2026-12-01",
    freeDays: 14,
    countMode: "calendar",
    standardDailyPence: 350,
    largeDailyPence: 700,
    handlingFeePence: 0,
  };

  it("says what was scheduled", () => {
    expect(historySentence(entry({ after }), TODAY)).toBe(
      "Scheduled new terms from Tue 1 Dec: 14 calendar days free, £3.50 a day, £7.00 for large works, no handling fee.",
    );
  });

  it("says what an edit changed, from and to", () => {
    expect(
      historySentence(
        entry({
          action: "terms_edited",
          before: after,
          after: { ...after, standardDailyPence: 400, largeDailyPence: null },
        }),
        TODAY,
      ),
    ).toBe(
      "Changed the terms from Tue 1 Dec: standard rate from £3.50 to £4.00; large rate from £7.00 to off.",
    );
  });

  it("says a cancel, a switch, a VAT choice and the move from Hours and rules", () => {
    expect(historySentence(entry({ action: "terms_cancelled", before: after }), TODAY)).toBe(
      "Cancelled the change from Tue 1 Dec.",
    );
    expect(
      historySentence(
        entry({ action: "charging_switched", after: { raiseInvoices: true } }),
        TODAY,
      ),
    ).toBe("Switched storage invoices on.");
    expect(
      historySentence(
        entry({ action: "charging_switched", after: { raiseInvoices: false } }),
        TODAY,
      ),
    ).toBe("Switched storage invoices off.");
    expect(
      historySentence(
        entry({ action: "vat_treatment_set", after: { vatTreatment: "standard_rated" } }),
        TODAY,
      ),
    ).toBe("Set the VAT treatment for storage to standard rated.");
    expect(
      historySentence(
        entry({
          action: "terms_migrated",
          before: { freeStorageDays: 21 },
          after: { freeDays: 21 },
        }),
        TODAY,
      ),
    ).toBe("Moved the free storage days (21) from Hours and rules into the first storage terms.");
  });
});
