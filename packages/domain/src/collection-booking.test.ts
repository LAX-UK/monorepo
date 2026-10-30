import { describe, expect, it } from "vitest";
import { type CollectionBookingSettings, collectionBookingOffer } from "./collection-booking.js";

const settings = (over: Partial<CollectionBookingSettings> = {}): CollectionBookingSettings => ({
  selfServeEnabled: false,
  slotCapacityPerHour: null,
  hours: null,
  bookingEmail: "collections@example.test",
  ...over,
});

describe("collectionBookingOffer", () => {
  it("offers email booking while self-serve is switched off", () => {
    expect(
      collectionBookingOffer(settings({ hours: "Weekdays 10:00 to 17:00" }), "Saleroom"),
    ).toEqual({
      kind: "email",
      email: "collections@example.test",
      hours: "Weekdays 10:00 to 17:00",
      place: "Saleroom",
    });
  });

  it("never offers slots without confirmed hours and capacity", () => {
    expect(collectionBookingOffer(settings({ selfServeEnabled: true }), null).kind).toBe("email");
    expect(
      collectionBookingOffer(settings({ selfServeEnabled: true, hours: "Weekdays" }), null).kind,
    ).toBe("email");
    expect(
      collectionBookingOffer(
        settings({ selfServeEnabled: true, hours: "Weekdays", slotCapacityPerHour: 0 }),
        null,
      ).kind,
    ).toBe("email");
  });

  it("offers self-serve once switched on with hours and capacity", () => {
    expect(
      collectionBookingOffer(
        settings({ selfServeEnabled: true, hours: "Weekdays", slotCapacityPerHour: 4 }),
        "Saleroom",
      ),
    ).toEqual({ kind: "self_serve", hours: "Weekdays", place: "Saleroom" });
  });
});
