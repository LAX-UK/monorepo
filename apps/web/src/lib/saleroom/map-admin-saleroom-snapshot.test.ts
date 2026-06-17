import { mapAdminSaleroomSnapshotToSessionStatus } from "@/lib/saleroom/map-admin-saleroom-snapshot";
import { describe, expect, it } from "vitest";

describe("mapAdminSaleroomSnapshotToSessionStatus", () => {
  it("normalizes active session status to live", () => {
    const status = mapAdminSaleroomSnapshotToSessionStatus({
      session: {
        id: "s1",
        saleId: "sale-1",
        status: "active",
        currentLotId: "lot-9",
        startedAt: null,
        endedAt: null,
        clerkUserId: null,
        auctioneerUserId: null,
        displayOverlay: null,
        createdAt: "",
        updatedAt: "",
      },
      events: [],
    });

    expect(status).toEqual({ status: "live", currentLotId: "lot-9" });
  });

  it("returns none when session is missing", () => {
    expect(mapAdminSaleroomSnapshotToSessionStatus({ session: null, events: [] })).toEqual({
      status: "none",
      currentLotId: null,
    });
  });
});
