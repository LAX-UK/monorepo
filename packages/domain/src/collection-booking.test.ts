import { describe, expect, it } from "vitest";
import {
  type CollectionBookingSettings,
  collectionBookingOffer,
  collectionSettingsFromPlace,
} from "./collection-booking.js";

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

describe("collectionSettingsFromPlace", () => {
  const place = {
    onlineBookingEnabled: true,
    visitMinutes: 30,
    placesPerSlot: 2,
    bookingEmail: null,
  };
  const fallback = settings({ hours: "From the environment", bookingEmail: "env@example.test" });

  it("takes the switch, capacity per hour and hours from the place", () => {
    const result = collectionSettingsFromPlace(place, "Monday to Friday, 10:00 to 19:00", fallback);
    expect(result).toEqual({
      selfServeEnabled: true,
      slotCapacityPerHour: 4,
      hours: "Monday to Friday, 10:00 to 19:00",
      bookingEmail: "env@example.test",
    });
    expect(collectionBookingOffer(result, "Gallery").kind).toBe("self_serve");
  });

  it("states capacity per hour for each visit length", () => {
    const capacity = (visitMinutes: number, placesPerSlot: number) =>
      collectionSettingsFromPlace({ ...place, visitMinutes, placesPerSlot }, "x", fallback)
        .slotCapacityPerHour;
    expect(capacity(15, 1)).toBe(4);
    expect(capacity(20, 3)).toBe(9);
    expect(capacity(45, 2)).toBe(2);
    expect(capacity(60, 10)).toBe(10);
  });

  it("falls back to email while the place's switch is off, with the place's hours", () => {
    const off = collectionSettingsFromPlace(
      { ...place, onlineBookingEnabled: false, bookingEmail: "desk@example.test" },
      "Monday to Friday, 10:00 to 19:00",
      fallback,
    );
    expect(collectionBookingOffer(off, "Gallery")).toEqual({
      kind: "email",
      email: "desk@example.test",
      hours: "Monday to Friday, 10:00 to 19:00",
      place: "Gallery",
    });
  });

  it("never offers slots for a place that is never open", () => {
    const closed = collectionSettingsFromPlace(place, null, fallback);
    expect(collectionBookingOffer(closed, null).kind).toBe("email");
  });
});
