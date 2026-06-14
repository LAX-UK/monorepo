import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import { mapOperationsSnapshotToRadarRow } from "./onsite-sales-radar-widget";

function snapshot(
  deliveryMode: "online" | "onsite" | "hybrid",
  overrides: Partial<AdminSaleOperationsSnapshot["registrations"]> = {},
): AdminSaleOperationsSnapshot {
  return {
    sale: {
      id: "sale-1",
      title: "Test sale",
      status: "active",
      deliveryMode,
      startTime: null,
      venueName: null,
      streamUrl: null,
    },
    saleroomSession: null,
    currentLotBidding: null,
    registrations: { pending: 2, approved: 0, rejected: 0, ...overrides },
    telephoneBookings: {
      requested: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
    },
    pendingActions: { registrations: [], telephone: [] },
  };
}

describe("mapOperationsSnapshotToRadarRow", () => {
  it("includes hybrid sales with pending operations work", () => {
    const row = mapOperationsSnapshotToRadarRow(snapshot("hybrid"));
    expect(row).toMatchObject({
      saleId: "sale-1",
      pendingRegistrations: 2,
    });
  });

  it("excludes online sales", () => {
    expect(mapOperationsSnapshotToRadarRow(snapshot("online"))).toBeNull();
  });
});
