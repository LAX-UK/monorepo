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
    storage: { clearedAt: CLEARED, freeStorageDays: null, bookingOpen: true, booked: false },
    quote: null,
    ...over,
  };
}

const at = (iso: string) => purchaseView(row(), actor, new Date(iso)).delivery.collectBy;

describe("the collect-by notice on a purchase", () => {
  it("names the day the reminder email names, upcoming then soon then overdue", () => {
    expect(at("2026-11-20T12:00:00Z")).toEqual({ date: "2026-12-09", state: "upcoming" });
    expect(at("2026-12-01T12:00:00Z")?.state).toBe("upcoming");
    expect(at("2026-12-02T12:00:00Z")?.state).toBe("soon");
    expect(at("2026-12-09T12:00:00Z")?.state).toBe("soon");
    expect(at("2026-12-10T12:00:00Z")).toEqual({ date: "2026-12-09", state: "overdue" });
  });

  it("uses the place's own free period when it is set", () => {
    const view = purchaseView(
      row({
        storage: { clearedAt: CLEARED, freeStorageDays: 14, bookingOpen: true, booked: false },
      }),
      actor,
      new Date("2026-11-20T12:00:00Z"),
    );
    expect(view.delivery.collectBy).toEqual({ date: "2026-11-23", state: "soon" });
  });

  it("goes once the lot is booked", () => {
    const booked = row({
      storage: { clearedAt: CLEARED, freeStorageDays: null, bookingOpen: true, booked: true },
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
      storage: { clearedAt: CLEARED, freeStorageDays: null, bookingOpen: false, booked: false },
    });
    expect(purchaseView(closed, actor, now).delivery.collectBy).toBeNull();
    expect(purchaseView(row({ storage: null }), actor, now).delivery.collectBy).toBeNull();
  });
});
