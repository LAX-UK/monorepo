import { describe, expect, it } from "vitest";
import { parseAdminSaleOperationsSnapshot } from "./admin-operations-snapshot.schema";

describe("parseAdminSaleOperationsSnapshot", () => {
  it("parses minimal sale envelope", () => {
    const parsed = parseAdminSaleOperationsSnapshot({
      sale: { id: "sale-1", title: "Evening sale", status: "active", deliveryMode: "hybrid" },
      registrations: { pending: 1, approved: 2, rejected: 0 },
      telephoneBookings: { requested: 0, confirmed: 1, inProgress: 0, completed: 0 },
      pendingActions: { registrations: [], telephone: [] },
    });
    expect(parsed?.sale.id).toBe("sale-1");
    expect(parsed?.registrations.approved).toBe(2);
  });

  it("returns null for invalid payload", () => {
    expect(parseAdminSaleOperationsSnapshot(null)).toBeNull();
    expect(parseAdminSaleOperationsSnapshot({ sale: { id: 1 } })).toBeNull();
  });
});
