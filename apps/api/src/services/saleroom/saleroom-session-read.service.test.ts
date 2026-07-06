import type { ISaleroomSessionRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { SaleroomSessionContext } from "./saleroom-session-context.js";
import { SaleroomSessionReadService } from "./saleroom-session-read.service.js";

function createReadService(
  overrides: {
    session?: Awaited<ReturnType<ISaleroomSessionRepository["findBySaleId"]>> | null;
    lots?: Array<{
      id: string;
      lotNumber: number;
      title: string;
      status: "active" | "scheduled" | "ended";
    }>;
  } = {},
) {
  const ctx = {
    sessionRepo: {
      findBySaleId: vi.fn().mockResolvedValue(overrides.session ?? null),
    },
    lotRepo: {
      findRunOrderRefsBySaleId: vi.fn().mockResolvedValue(overrides.lots ?? []),
    },
  } as unknown as SaleroomSessionContext;

  return { service: new SaleroomSessionReadService(ctx), ctx };
}

describe("SaleroomSessionReadService.getPublicSessionStatus", () => {
  it("returns nextLotId when session is live", async () => {
    const { service } = createReadService({
      session: {
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: "lot-1",
      } as never,
      lots: [
        { id: "lot-1", lotNumber: 1, title: "Lot 1", status: "active" },
        { id: "lot-2", lotNumber: 2, title: "Lot 2", status: "scheduled" },
        { id: "lot-3", lotNumber: 3, title: "Lot 3", status: "ended" },
      ],
    });

    const status = await service.getPublicSessionStatus("sale-1");
    expect(status).toEqual({
      status: "live",
      currentLotId: "lot-1",
      nextLotId: "lot-2",
    });
  });

  it("omits nextLotId when session is not live or paused", async () => {
    const { service } = createReadService({
      session: {
        id: "session-1",
        saleId: "sale-1",
        status: "ended",
        currentLotId: null,
      } as never,
      lots: [{ id: "lot-1", lotNumber: 1, title: "Lot 1", status: "active" }],
    });

    const status = await service.getPublicSessionStatus("sale-1");
    expect(status).toEqual({ status: "ended", currentLotId: null });
  });
});
