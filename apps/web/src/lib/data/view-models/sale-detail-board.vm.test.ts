import { describe, expect, it } from "vitest";
import {
  filterSaleRegistrations,
  matchesSaleRegistrationSearch,
  registrationCheckInStatus,
} from "./sale-registrations-tab.vm";

describe("sale-registrations-tab.vm", () => {
  const rows = [
    {
      id: "1",
      status: "pending" as const,
      userName: "Alice",
      userEmail: "alice@example.com",
      paddleNumber: null,
      checkedInAt: null,
    },
    {
      id: "2",
      status: "approved" as const,
      userName: "Bob",
      userEmail: "bob@example.com",
      paddleNumber: 12,
      checkedInAt: "2026-01-01T10:00:00Z",
    },
  ] as never;

  it("filterSaleRegistrations filters pending and checked in", () => {
    expect(filterSaleRegistrations(rows, "pending")).toHaveLength(1);
    expect(filterSaleRegistrations(rows, "checked_in")).toHaveLength(1);
  });

  it("matchesSaleRegistrationSearch matches paddle number", () => {
    expect(matchesSaleRegistrationSearch(rows[1], "12")).toBe(true);
    expect(matchesSaleRegistrationSearch(rows[0], "bob")).toBe(false);
  });

  it("registrationCheckInStatus follows the bidder to the door", () => {
    expect(registrationCheckInStatus(rows[1])?.label).toBe("Checked in");
    expect(registrationCheckInStatus(rows[0])).toBeNull();
    const approved = { status: "approved", checkedInAt: null, paddleNumber: null } as never;
    expect(registrationCheckInStatus(approved)?.label).toBe("Awaiting paddle");
  });
});
