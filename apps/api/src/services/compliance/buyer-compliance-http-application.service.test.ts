import { describe, expect, it, vi } from "vitest";
import { BuyerComplianceHttpApplicationService } from "./buyer-compliance-http-application.service.js";

describe("BuyerComplianceHttpApplicationService", () => {
  it("returns buyer SoF view from document collection port", async () => {
    const view = { cases: [] };
    const service = new BuyerComplianceHttpApplicationService({
      getBuyerView: vi.fn().mockResolvedValue(view),
    } as never);
    const out = await service.getBuyerSourceOfFundsView("buyer-1");
    expect(out.data).toEqual(view);
  });
});
