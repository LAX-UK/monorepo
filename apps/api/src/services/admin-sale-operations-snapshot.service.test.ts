import { describe, expect, it, vi } from "vitest";
import { AdminSaleOperationsSnapshotService } from "./admin-sale-operations-snapshot.service.js";

describe("AdminSaleOperationsSnapshotService.listOperationsRadar", () => {
  it("loads snapshots for active saleroom sales in one batch", async () => {
    const reader = {
      listActiveSaleroomSaleIds: vi.fn().mockResolvedValue(["sale-1", "sale-2"]),
      findSaleroomSale: vi.fn().mockResolvedValue({
        id: "sale-1",
        title: "Hybrid sale",
        status: "active",
        deliveryMode: "hybrid",
        startTime: null,
        locationName: null,
        streamUrl: null,
      }),
      findSession: vi.fn().mockResolvedValue(null),
      findCurrentLot: vi.fn(),
      loadCurrentLotBidding: vi.fn(),
    };
    const saleRegistrationService = {
      listForSaleAdmin: vi.fn().mockResolvedValue([]),
    };
    const telephoneBidBookingService = {
      listForSaleAdmin: vi.fn().mockResolvedValue([]),
    };
    const service = new AdminSaleOperationsSnapshotService(
      reader as never,
      saleRegistrationService as never,
      telephoneBidBookingService as never,
    );

    const items = await service.listOperationsRadar(6);

    expect(reader.listActiveSaleroomSaleIds).toHaveBeenCalledWith(6);
    expect(items).toHaveLength(2);
  });
});
