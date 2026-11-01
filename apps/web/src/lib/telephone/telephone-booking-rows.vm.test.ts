import { describe, expect, it } from "vitest";
import { telephoneBookingRow } from "./telephone-booking-rows.vm";
import type { TelephoneBookingListItem } from "./telephone-booking-types";

const base: TelephoneBookingListItem = {
  id: "tb1",
  saleId: "s1",
  status: "requested",
  lotIds: [],
  authorizedMax: null,
  buyerNotes: null,
  phoneE164: "+447700900123",
  limitIncreaseRequestedAt: null,
  limitIncreaseAmount: null,
  completedLotIds: [],
  createdAt: "2026-10-28T10:00:00Z",
  confirmedAt: null,
  updatedAt: "2026-10-28T10:00:00Z",
  saleTitle: "Autumn Evening Sale",
};

describe("telephoneBookingRow", () => {
  it("opens the booking and names the sale, when it was asked for and how many lots", () => {
    const row = telephoneBookingRow({ ...base, lotIds: ["a", "b", "c"] });
    expect(row.href).toBe("/bids/telephone/tb1");
    expect(row.title).toBe("Autumn Evening Sale");
    expect(row.meta).toEqual(["Asked 28 Oct 2026", "3 lots"]);
  });

  it("says a requested line has no maximum yet, in words on one line, never a blank figure", () => {
    expect(telephoneBookingRow(base).figure).toEqual({
      value: "Not set yet",
      label: "your maximum",
      pending: true,
    });
  });

  it("shows the agreed maximum in pounds, and no figure on a finished line without one", () => {
    expect(
      telephoneBookingRow({ ...base, status: "confirmed", authorizedMax: "12500" }).figure,
    ).toEqual({ value: "£12,500", label: "your maximum" });
    expect(telephoneBookingRow({ ...base, status: "completed" }).figure).toBeNull();
  });

  it("draws each state from the one table, in the booking page's words", () => {
    expect(telephoneBookingRow(base).status).toEqual({
      label: "Requested",
      tone: "info",
      shape: "dot",
    });
    expect(telephoneBookingRow({ ...base, status: "confirmed" }).status.tone).toBe("success");
    expect(telephoneBookingRow({ ...base, status: "cancelled" }).status.tone).toBe("neutral");
  });

  it("falls back to a plain name when the sale title is missing", () => {
    expect(telephoneBookingRow({ ...base, saleTitle: null, lotIds: ["a"] })).toMatchObject({
      title: "Onsite sale",
      meta: ["Asked 28 Oct 2026", "1 lot"],
    });
  });
});
