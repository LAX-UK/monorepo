import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminPayoutListQueryService } from "./admin-payout-list-query.service.js";

function repo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    countMatching: vi.fn().mockResolvedValue(0),
    summarizeMatching: vi.fn().mockResolvedValue({}),
  };
}

describe("AdminPayoutListQueryService", () => {
  it("applies the search to the rows, the count and the summary alike", async () => {
    const payouts = repo();
    const service = new AdminPayoutListQueryService(payouts as unknown as IPayoutRepository);

    await service.getPage({ search: "PO-2026-3FA9C1D2", status: "paid", limit: 25, offset: 50 });

    const filter = { search: "PO-2026-3FA9C1D2", status: "paid" };
    expect(payouts.list).toHaveBeenCalledWith({ ...filter, limit: 25, offset: 50 });
    expect(payouts.countMatching).toHaveBeenCalledWith(filter);
    expect(payouts.summarizeMatching).toHaveBeenCalledWith(filter);
  });

  it("leaves the search out when none was typed", async () => {
    const payouts = repo();
    const service = new AdminPayoutListQueryService(payouts as unknown as IPayoutRepository);

    await service.getPage({ limit: 25, offset: 0 });

    expect(payouts.countMatching).toHaveBeenCalledWith({});
  });
});
