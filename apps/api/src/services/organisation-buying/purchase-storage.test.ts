import { DEFAULT_COLLECTION_RULES, createCollectionCalendar } from "@auction/domain";
import type { AccountPurchaseFactsRow } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { purchaseStorageOf } from "./purchase-storage.js";

const calendar = createCollectionCalendar({
  hours: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "19:00",
  })),
  exceptions: [],
  rules: DEFAULT_COLLECTION_RULES,
});

type Storage = NonNullable<AccountPurchaseFactsRow["storage"]>;
type Pricing = NonNullable<Storage["pricing"]>;

// Payment cleared Mon 2 Nov 2026; 14 days free, so collect by Mon 16 Nov.
const storage = (pricing: Partial<Pricing> = {}): Storage => ({
  clearedAt: new Date("2026-11-02T10:00:00Z"),
  placeId: "venue-1",
  placeName: "LAX Gallery",
  freeStorageDays: null,
  bookingOpen: true,
  booked: false,
  saleDeleted: false,
  calendar,
  pricing: {
    terms: {
      freeDays: 14,
      countMode: "calendar",
      standardDailyPence: 300,
      largeDailyPence: 600,
      handlingFeePence: 0,
      effectiveFrom: "2026-10-01",
    },
    large: false,
    extensionDays: 0,
    waived: false,
    chargingOn: true,
    ...pricing,
  },
});

const at = (iso: string, pricing: Partial<Pricing> = {}) =>
  purchaseStorageOf(storage(pricing), new Date(iso));

describe("the buyer's storage view of a purchase", () => {
  it("is absent for a lot won before the first terms, which keeps the legacy notice", () => {
    expect(at("2026-11-10T12:00:00Z", { terms: null })).toBeNull();
    expect(purchaseStorageOf({ ...storage(), pricing: undefined }, new Date())).toBeNull();
  });

  it("upcoming, then soon, then charging with the running total", () => {
    expect(at("2026-11-03T12:00:00Z")).toMatchObject({
      date: "2026-11-16",
      state: "upcoming",
      storage: { badge: "Collect by Mon 16 Nov" },
    });
    expect(at("2026-11-10T12:00:00Z")?.state).toBe("soon");
    const charging = at("2026-11-19T12:00:00Z");
    expect(charging).toMatchObject({ state: "overdue" });
    expect(charging?.storage).toMatchObject({
      state: "charging",
      amountPence: 900,
      badge: "Collect by Mon 16 Nov · Storage £9.00 so far",
    });
    expect(charging?.storage.notice.heading).toBe("Storage charges since Tue 17 Nov");
  });

  it("prices a large work at the large rate", () => {
    expect(at("2026-11-18T12:00:00Z", { large: true })?.storage.amountPence).toBe(1200);
  });

  it("charging off keeps today's wording after the day and no running total on the badge", () => {
    const off = at("2026-11-19T12:00:00Z", { chargingOn: false });
    expect(off?.storage.notice.body).toBe(
      "That day has passed, so storage charges may apply. Book a time to collect your work from LAX Gallery, or email us if you need longer.",
    );
    expect(off?.storage.badge).toBe("Collect by Mon 16 Nov");
    // Nothing is billed while charging is off, so nothing is due.
    expect(off?.storage.amountPence).toBe(0);
  });

  it("still shows the rates before the day while charging is off", () => {
    expect(at("2026-11-03T12:00:00Z", { chargingOn: false })?.storage.notice.body).toContain(
      "£3 a day after that",
    );
  });

  it("an extension moves the day and a waiver clears the total", () => {
    expect(at("2026-11-03T12:00:00Z", { extensionDays: 7 })).toMatchObject({
      date: "2026-11-23",
      storage: { state: "extended", notice: { heading: "Free storage extended to Mon 23 Nov" } },
    });
    expect(at("2026-12-01T12:00:00Z", { waived: true })?.storage).toMatchObject({
      state: "waived",
      amountPence: 0,
      notice: { heading: "No storage to pay" },
    });
  });

  it("names the handling fee in the running total", () => {
    const withFee = at("2026-11-19T12:00:00Z", {
      terms: {
        freeDays: 14,
        countMode: "calendar",
        standardDailyPence: 300,
        largeDailyPence: null,
        handlingFeePence: 500,
        effectiveFrom: "2026-10-01",
      },
    });
    expect(withFee?.storage.notice.body).toContain(
      "£14.00 so far (3 days at £3 a day, and a £5 handling fee)",
    );
  });

  it("counts working days when the terms say so", () => {
    const working = at("2026-11-03T12:00:00Z", {
      terms: {
        freeDays: 5,
        countMode: "working",
        standardDailyPence: 300,
        largeDailyPence: null,
        handlingFeePence: 0,
        effectiveFrom: "2026-10-01",
      },
    });
    // Cleared Mon 2 Nov: five working days later is Mon 9 Nov.
    expect(working?.date).toBe("2026-11-09");
  });

  it("uses the London day, not the UTC day, in summer time", () => {
    // Cleared Mon 1 Jun 2026, so the last free day is Mon 15 Jun. At 23:30 UTC on the 15th it is
    // already 00:30 on Tue 16 Jun in London (BST), so one charged day is owed. The UTC day would
    // still read as the last free day.
    const june = { ...storage(), clearedAt: new Date("2026-06-01T10:00:00Z") };
    const result = purchaseStorageOf(june, new Date("2026-06-15T23:30:00Z"));
    expect(result?.date).toBe("2026-06-15");
    expect(result?.storage).toMatchObject({ state: "charging", amountPence: 300 });
  });

  it("a waived lot past its day reads as nothing to pay, in the neutral state", () => {
    const waived = at("2026-11-25T12:00:00Z", { waived: true });
    expect(waived).toMatchObject({
      date: "2026-11-16",
      state: "upcoming",
      storage: { state: "waived", amountPence: 0, notice: { heading: "No storage to pay" } },
    });
  });

  it("a shipping quote LAX still owes pauses the clock (ST5)", () => {
    const quote = (over: Partial<NonNullable<AccountPurchaseFactsRow["quote"]>>) =>
      ({
        id: "q1",
        lotId: "lot-1",
        buyerLegalEntityId: "le-1",
        status: "requested",
        destination: "Paris",
        amount: null,
        currency: "GBP",
        quoteNote: null,
        requestedByUserId: null,
        requestedAt: new Date("2026-11-10T12:00:00Z"),
        quotedAt: null,
        decidedByUserId: null,
        decidedAt: null,
        ...over,
      }) as NonNullable<AccountPurchaseFactsRow["quote"]>;
    const now = new Date("2026-11-19T12:00:00Z");
    // Without the pause the lot would be charging (collect by Mon 16 Nov).
    expect(purchaseStorageOf(storage(), now)?.storage.state).toBe("charging");
    const held = purchaseStorageOf(storage(), now, quote({}));
    expect(held?.storage).toMatchObject({ amountPence: 0 });
    expect(held?.date).not.toBe("2026-11-16");
    // Once quoted, only the days it waited are paused: asked Tue 10 Nov, quoted Thu 12 Nov.
    const answered = purchaseStorageOf(
      storage(),
      now,
      quote({ status: "quoted", quotedAt: new Date("2026-11-12T12:00:00Z") }),
    );
    expect(answered?.date).toBe("2026-11-19");
  });
});
