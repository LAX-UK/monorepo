import { describe, expect, it } from "vitest";
import { describePendingWork } from "./describe-pending-work";

describe("describePendingWork", () => {
  it("names each kind in full words with the right plural", () => {
    expect(describePendingWork({ registrations: 1, telephoneBookings: 2 })).toBe(
      "1 registration waiting, 2 telephone bookings waiting",
    );
  });

  it("leaves out what is not waiting", () => {
    expect(describePendingWork({ registrations: 0, telephoneBookings: 1 })).toBe(
      "1 telephone booking waiting",
    );
  });

  it("has a fallback when nothing specific is waiting", () => {
    expect(describePendingWork({ registrations: 0, telephoneBookings: 0 })).toBe(
      "New work is waiting",
    );
  });
});
