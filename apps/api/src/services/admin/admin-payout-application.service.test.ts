import { describe, expect, it, vi } from "vitest";
import { AdminPayoutApplicationService } from "./admin-payout-application.service.js";

const NOW = new Date("2026-11-07T12:00:00Z");
const LAST_END = new Date("2026-10-31T23:59:59Z");
const ENTITY = "entity-1";
const REASON = "Month-end settlement run";

function setup(latest: { periodEnd: Date } | null, earliestCapturedAt: Date | null = null) {
  const payouts = {
    adminList: vi.fn().mockResolvedValue(latest ? [latest] : []),
    adminSettlementPreview: vi.fn().mockResolvedValue({
      pending: { paymentCount: 1, earliestCapturedAt },
      openPayout: null,
    }),
  };
  const settlements = {
    createSettlement: vi.fn().mockResolvedValue({ ok: true, payout: { id: "po-1", lines: [] } }),
  };
  const service = new AdminPayoutApplicationService(
    // biome-ignore lint/suspicious/noExplicitAny: the fakes carry only the methods read.
    payouts as any,
    // biome-ignore lint/suspicious/noExplicitAny: the fakes carry only the methods read.
    settlements as any,
    // biome-ignore lint/suspicious/noExplicitAny: unused here.
    {} as any,
    { retry: vi.fn() },
    { resolve: vi.fn() },
    () => NOW,
  );
  return { service, payouts, settlements };
}

describe("AdminPayoutApplicationService.createSettlement", () => {
  it("settles from the last settled period end to now, with the reason", async () => {
    const { service, settlements } = setup({ periodEnd: LAST_END });

    const result = await service.createSettlement("staff-1", {
      legalEntityId: ENTITY,
      reason: REASON,
    });

    expect(result.ok).toBe(true);
    expect(settlements.createSettlement).toHaveBeenCalledWith("staff-1", {
      legalEntityId: ENTITY,
      periodStart: LAST_END,
      periodEnd: NOW,
      reason: REASON,
    });
  });

  it("starts a first settlement at the oldest waiting payment, not the epoch", async () => {
    const oldest = new Date("2026-09-02T08:00:00Z");
    const { service, settlements } = setup(null, oldest);

    await service.createSettlement("staff-1", { legalEntityId: ENTITY, reason: REASON });

    expect(settlements.createSettlement).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({ periodStart: oldest, periodEnd: NOW }),
    );
  });

  it("refuses a period that overlaps the last settled one, and creates nothing", async () => {
    const { service, settlements } = setup({ periodEnd: LAST_END });

    const result = await service.createSettlement("staff-1", {
      legalEntityId: ENTITY,
      reason: REASON,
      periodStart: new Date("2026-10-01T00:00:00Z"),
    });

    expect(result).toEqual({ ok: false, reason: "settlement_period_overlaps" });
    expect(settlements.createSettlement).not.toHaveBeenCalled();
  });

  it("refuses an open-ended period starting at the epoch, and creates nothing", async () => {
    const { service, settlements } = setup(null);

    const result = await service.createSettlement("staff-1", {
      legalEntityId: ENTITY,
      reason: REASON,
      periodStart: new Date(0),
    });

    expect(result).toEqual({ ok: false, reason: "settlement_period_open_ended" });
    expect(settlements.createSettlement).not.toHaveBeenCalled();
  });
});
