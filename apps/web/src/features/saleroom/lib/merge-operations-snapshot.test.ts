import {
  mergeOperationsSnapshot,
  resolveLotOnBlock,
  shouldShowRadarRow,
} from "@/features/saleroom/lib/merge-operations-snapshot";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { describe, expect, it } from "vitest";

function snapshot(
  overrides: Partial<AdminSaleOperationsSnapshot> = {},
): AdminSaleOperationsSnapshot {
  return {
    sale: {
      id: "sale-1",
      title: "Hybrid evening",
      status: "active",
      deliveryMode: "hybrid",
      startTime: null,
      venueName: null,
      streamUrl: null,
    },
    saleroomSession: {
      status: "live",
      currentLotId: "lot-1",
      currentLotNumber: 12,
      currentLotTitle: "Test lot",
    },
    currentLotBidding: {
      currentPrice: "500.00",
      leaderRef: "Paddle 142",
      bidCount: 3,
    },
    registrations: { pending: 0, approved: 2, rejected: 0 },
    telephoneBookings: {
      requested: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
    },
    pendingActions: { registrations: [], telephone: [] },
    ...overrides,
  };
}

describe("merge-operations-snapshot", () => {
  it("merges live session overlay over snapshot", () => {
    const vm = mergeOperationsSnapshot(
      snapshot(),
      {
        status: "live",
        currentLotId: "lot-2",
        connectionStatus: "connected",
        lastEventAt: "2026-06-16T10:00:00.000Z",
      },
      {
        currentPrice: "600.00",
        bidCount: 4,
        leaderLabel: "Online",
      },
      3,
    );
    expect(vm.currentLotId).toBe("lot-2");
    expect(vm.currentPrice).toBe("600.00");
    expect(vm.leaderLabel).toBe("Online");
    expect(vm.checkedInPaddleCount).toBe(3);
  });

  it("resolves lot title and number from lots when session advances", () => {
    const vm = mergeOperationsSnapshot(
      snapshot(),
      {
        status: "live",
        currentLotId: "lot-99",
        connectionStatus: "connected",
        lastEventAt: null,
      },
      { currentPrice: null, bidCount: null, leaderLabel: null },
      0,
      [
        {
          id: "lot-99",
          lotNumber: 42,
          title: "Advanced lot",
        } as import("@auction/types").Lot,
      ],
    );
    expect(vm.currentLotNumber).toBe(42);
    expect(vm.currentLotTitle).toBe("Advanced lot");
  });

  it("resolveLotOnBlock falls back to snapshot when lot missing from catalog", () => {
    const resolved = resolveLotOnBlock("lot-missing", [], {
      lotNumber: 7,
      lotTitle: "Snapshot lot",
    });
    expect(resolved.lotNumber).toBe(7);
    expect(resolved.lotTitle).toBe("Snapshot lot");
  });

  it("shows radar row for live hybrid with no pending work", () => {
    expect(
      shouldShowRadarRow({
        deliveryMode: "hybrid",
        pendingRegistrations: 0,
        pendingTelephone: 0,
        inProgressTelephone: 0,
        sessionStatus: "live",
      }),
    ).toBe(true);
  });

  it("hides online sales from radar", () => {
    expect(
      shouldShowRadarRow({
        deliveryMode: "online",
        pendingRegistrations: 2,
        pendingTelephone: 0,
        inProgressTelephone: 0,
        sessionStatus: null,
      }),
    ).toBe(false);
  });
});
