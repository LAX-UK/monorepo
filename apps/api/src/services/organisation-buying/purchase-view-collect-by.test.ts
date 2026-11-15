import { bankHolidayClosures, createCollectionCalendar } from "@auction/domain";
import type { AccountPurchaseFactsRow } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { BUYING_ACCOUNT } from "../../testing/in-memory-workspace-buying.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { purchaseView } from "./purchase-view.js";

const actor: OrganisationMemberActor = {
  userId: "owner-1",
  legalEntityId: BUYING_ACCOUNT,
  role: "owner",
  isImpersonation: false,
} as OrganisationMemberActor;

// Payment cleared Mon 9 Nov 2026: free for 30 days, so collect by Wed 9 Dec.
const CLEARED = new Date("2026-11-09T10:00:00Z");
const PLACE_ID = "venue-marylebone";

function row(over: Partial<AccountPurchaseFactsRow> = {}): AccountPurchaseFactsRow {
  return {
    lotId: "lot-1",
    buyerAccountKind: "organisation",
    lotTitle: "Blue Abstract",
    lotNumber: 1,
    saleId: "s1",
    saleTitle: "Winter",
    hammerPrice: "1000.00",
    wonBy: null,
    wonAt: new Date("2026-11-01T10:00:00Z"),
    payment: {
      id: "p1",
      status: "captured",
      amount: "1250.00",
      raisedAt: new Date("2026-11-02T10:00:00Z"),
      dueAt: null,
    },
    fulfilment: {
      status: "released",
      method: "collection",
      carrier: null,
      trackingNumber: null,
      collectedBy: null,
      collectedAt: null,
    },
    storage: {
      clearedAt: CLEARED,
      placeId: PLACE_ID,
      placeName: "Marylebone",
      freeStorageDays: null,
      bookingOpen: true,
      booked: false,
      saleDeleted: false,
    },
    quote: null,
    ...over,
  };
}

const at = (iso: string) => purchaseView(row(), actor, new Date(iso)).delivery.collectBy;

describe("the collect-by notice on a purchase", () => {
  it("names the day the reminder email names, upcoming then soon then overdue", () => {
    expect(at("2026-11-20T12:00:00Z")).toEqual({
      date: "2026-12-09",
      state: "upcoming",
      placeId: PLACE_ID,
      placeName: "Marylebone",
    });
    expect(at("2026-12-01T12:00:00Z")?.state).toBe("upcoming");
    expect(at("2026-12-02T12:00:00Z")?.state).toBe("soon");
    expect(at("2026-12-09T12:00:00Z")?.state).toBe("soon");
    expect(at("2026-12-10T12:00:00Z")).toEqual({
      date: "2026-12-09",
      state: "overdue",
      placeId: PLACE_ID,
      placeName: "Marylebone",
    });
  });

  it("uses the place's own free period when it is set", () => {
    const view = purchaseView(
      row({
        storage: {
          clearedAt: CLEARED,
          placeId: PLACE_ID,
          placeName: "Marylebone",
          freeStorageDays: 14,
          bookingOpen: true,
          booked: false,
          saleDeleted: false,
        },
      }),
      actor,
      new Date("2026-11-20T12:00:00Z"),
    );
    expect(view.delivery.collectBy).toEqual({
      date: "2026-11-23",
      state: "soon",
      placeId: PLACE_ID,
      placeName: "Marylebone",
    });
  });

  it("goes once the lot is booked", () => {
    const booked = row({
      storage: {
        clearedAt: CLEARED,
        placeId: PLACE_ID,
        placeName: "Marylebone",
        freeStorageDays: null,
        bookingOpen: true,
        booked: true,
        saleDeleted: false,
      },
    });
    expect(
      purchaseView(booked, actor, new Date("2026-11-20T12:00:00Z")).delivery.collectBy,
    ).toBeNull();
  });

  it("goes once the lot is collected, or leaves by courier", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const fulfilment = (status: "delivered" | "in_transit", method: "collection" | "shipping") => ({
      status,
      method,
      carrier: null,
      trackingNumber: null,
      collectedBy: null,
      collectedAt: null,
    });
    expect(
      purchaseView(row({ fulfilment: fulfilment("delivered", "collection") }), actor, now).delivery
        .collectBy,
    ).toBeNull();
    expect(
      purchaseView(row({ fulfilment: fulfilment("in_transit", "shipping") }), actor, now).delivery
        .collectBy,
    ).toBeNull();
    expect(
      purchaseView(
        row({ fulfilment: { ...fulfilment("in_transit", "shipping"), status: "released" } }),
        actor,
        now,
      ).delivery.collectBy,
    ).toBeNull();
  });

  it("is absent where no online booking is open, or nothing has been paid", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const closed = row({
      storage: {
        clearedAt: CLEARED,
        placeId: PLACE_ID,
        placeName: "Marylebone",
        freeStorageDays: null,
        bookingOpen: false,
        booked: false,
        saleDeleted: false,
      },
    });
    expect(purchaseView(closed, actor, now).delivery.collectBy).toBeNull();
    expect(purchaseView(row({ storage: null }), actor, now).delivery.collectBy).toBeNull();
  });
});

describe("the collect-by notice follows the reminder email's exclusions", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const fulfilment = (
    status: "released" | "ready_for_collection",
    method: "collection" | "shipping" | null,
  ) => ({
    status,
    method,
    carrier: null,
    trackingNumber: null,
    collectedBy: null,
    collectedAt: null,
  });

  it("is absent for a lot going by courier, even while it is ready for collection or quoted", () => {
    const shipping = row({ fulfilment: fulfilment("ready_for_collection", "shipping") });
    expect(purchaseView(shipping, actor, now).delivery.collectBy).toBeNull();
    const quoted = row({
      fulfilment: fulfilment("released", "shipping"),
      quote: {
        id: "q1",
        lotId: "lot-1",
        buyerLegalEntityId: BUYING_ACCOUNT,
        status: "quoted",
        destination: "London",
        amount: "120.00",
        currency: "GBP",
        quoteNote: null,
        requestedByUserId: "owner-1",
        requestedAt: new Date("2026-11-10T10:00:00Z"),
        quotedAt: new Date("2026-11-11T10:00:00Z"),
        decidedByUserId: null,
        decidedAt: null,
      },
    });
    expect(purchaseView(quoted, actor, now).delivery.collectBy).toBeNull();
  });

  it("is absent for a lot in a soft-deleted sale", () => {
    const deleted = row({
      storage: {
        clearedAt: CLEARED,
        placeId: PLACE_ID,
        placeName: "Marylebone",
        freeStorageDays: null,
        bookingOpen: true,
        booked: false,
        saleDeleted: true,
      },
    });
    expect(purchaseView(deleted, actor, now).delivery.collectBy).toBeNull();
  });

  it("stays while the work waits even if the invoice was refunded, as the email does", () => {
    const refunded = row({
      payment: {
        id: "p1",
        status: "refunded",
        amount: "1250.00",
        raisedAt: new Date("2026-11-02T10:00:00Z"),
        dueAt: null,
      },
      fulfilment: fulfilment("ready_for_collection", "collection"),
    });
    expect(purchaseView(refunded, actor, now).delivery.collectBy).toEqual({
      date: "2026-12-09",
      state: "upcoming",
      placeId: PLACE_ID,
      placeName: "Marylebone",
    });
  });
});

describe("the collect-by notice on a day the place is closed", () => {
  const calendar = createCollectionCalendar({
    hours: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      opensLocal: "10:00",
      closesLocal: "19:00",
    })),
    exceptions: bankHolidayClosures([2026]),
    rules: { closeOnSaleDays: false },
  });
  const withCalendar = (clearedAt: Date, now: string) =>
    purchaseView(
      row({
        storage: {
          clearedAt,
          placeId: PLACE_ID,
          placeName: "Marylebone",
          freeStorageDays: null,
          calendar,
          bookingOpen: true,
          booked: false,
          saleDeleted: false,
        },
      }),
      actor,
      new Date(now),
    ).delivery.collectBy;

  it("moves a weekend deadline to Monday", () => {
    // Cleared Thu 12 Nov: 30 days on is Sat 12 Dec.
    expect(withCalendar(new Date("2026-11-12T10:00:00Z"), "2026-11-20T12:00:00Z")?.date).toBe(
      "2026-12-14",
    );
  });

  it("moves a bank holiday deadline to the next open day, and is overdue only after it", () => {
    // Cleared Wed 25 Nov: 30 days on is Fri 25 Dec; Boxing Day's Monday is also a holiday.
    const cleared = new Date("2026-11-25T10:00:00Z");
    expect(withCalendar(cleared, "2026-12-01T12:00:00Z")?.date).toBe("2026-12-29");
    expect(withCalendar(cleared, "2026-12-28T12:00:00Z")?.state).toBe("soon");
    expect(withCalendar(cleared, "2026-12-30T12:00:00Z")?.state).toBe("overdue");
  });
});
