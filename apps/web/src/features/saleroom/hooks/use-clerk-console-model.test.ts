import { useClerkConsoleModel } from "@/features/saleroom/hooks/use-clerk-console-model";
import type { StaffSaleroomSessionVM } from "@/features/saleroom/types/staff-saleroom.vm";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const session: StaffSaleroomSessionVM = {
  status: "live",
  currentLotId: "lot-1",
  isSessionActive: true,
  isSessionLive: true,
  lastEventAt: null,
  connectionStatus: "connected",
};

const liveBid: ClerkLotLiveBidState = {
  currentPrice: "100.00",
  bidCount: 0,
  leaderUserId: null,
  leaderAmount: null,
  placedVia: null,
  leaderLabel: null,
};

const paddle: AdminPaddleRosterEntry = {
  userId: "user-1",
  paddleNumber: 101,
  displayName: "Collector One",
  bidLimit: null,
  hasActiveSelfServiceSession: false,
};

describe("useClerkConsoleModel paddle roster alerts", () => {
  it("does not show empty-roster alert when paddleRoster has entries", () => {
    const { result } = renderHook(() =>
      useClerkConsoleModel({
        saleId: "sale-1",
        saleTitle: "Hybrid sale",
        lots: [],
        telephoneBookings: [],
        paddleRoster: [paddle],
        paddleRosterEmpty: false,
        hammeredLotIds: new Set(),
        session,
        activityLog: [],
        liveBid,
      }),
    );

    expect(result.current.feedback.alerts.some((alert) => alert.key === "paddles")).toBe(false);
  });

  it("shows empty-roster alert when paddleRoster is empty", () => {
    const { result } = renderHook(() =>
      useClerkConsoleModel({
        saleId: "sale-1",
        saleTitle: "Hybrid sale",
        lots: [],
        telephoneBookings: [],
        paddleRoster: [],
        paddleRosterEmpty: true,
        hammeredLotIds: new Set(),
        session,
        activityLog: [],
        liveBid,
      }),
    );

    expect(result.current.feedback.alerts.some((alert) => alert.key === "paddles")).toBe(true);
  });
});
