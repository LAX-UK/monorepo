import { describe, expect, it, vi } from "vitest";
import { UserDashboardHttpApplicationService } from "./user-dashboard-http-application.service.js";

describe("UserDashboardHttpApplicationService", () => {
  it("returns empty portfolio when user has no winning lots", async () => {
    const svc = new UserDashboardHttpApplicationService({
      conditionReportService: {} as never,
      userDashboardReadService: {} as never,
      lotService: { list: vi.fn().mockResolvedValue([]) } as never,
      paymentBuyerService: {
        listMyPaymentsForBuyerApi: vi.fn().mockResolvedValue({ data: [] }),
      } as never,
      mediaUrlResolver: { resolve: vi.fn(async (x: string | null) => x) } as never,
      mediaAssetEnricher: {} as never,
      saleService: { findByIds: vi.fn(async () => []) } as never,
    });

    const response = await svc.listPortfolio({ userId: "u1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });
});
