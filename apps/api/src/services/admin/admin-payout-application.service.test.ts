import { describe, expect, it, vi } from "vitest";
import { AdminPayoutApplicationService } from "./admin-payout-application.service.js";

const NOW = new Date("2026-11-07T12:00:00Z");
const ENTITY = "entity-1";
const REASON = "Month-end settlement run";

function setup() {
  const settlements = {
    createSettlement: vi.fn().mockResolvedValue({ ok: true, payout: { id: "po-1", lines: [] } }),
  };
  const service = new AdminPayoutApplicationService(
    // biome-ignore lint/suspicious/noExplicitAny: the fakes carry only the methods read.
    {} as any,
    // biome-ignore lint/suspicious/noExplicitAny: the fakes carry only the methods read.
    settlements as any,
    // biome-ignore lint/suspicious/noExplicitAny: unused here.
    {} as any,
    { retry: vi.fn() },
    { resolve: vi.fn() },
    () => NOW,
  );
  return { service, settlements };
}

describe("AdminPayoutApplicationService.createSettlement", () => {
  it("hands the settlement the moment of the run and the reason; it works the period out itself", async () => {
    const { service, settlements } = setup();

    await service.createSettlement("staff-1", { legalEntityId: ENTITY, reason: REASON });

    expect(settlements.createSettlement).toHaveBeenCalledWith("staff-1", {
      legalEntityId: ENTITY,
      periodEnd: NOW,
      reason: REASON,
    });
  });

  it("passes a requested start on for the settlement to check", async () => {
    const { service, settlements } = setup();
    const start = new Date("2026-10-01T00:00:00Z");

    await service.createSettlement("staff-1", {
      legalEntityId: ENTITY,
      reason: REASON,
      periodStart: start,
    });

    expect(settlements.createSettlement).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({ periodStart: start, periodEnd: NOW }),
    );
  });

  it("returns a refusal from the settlement as it is", async () => {
    const { service, settlements } = setup();
    settlements.createSettlement.mockResolvedValue({
      ok: false,
      reason: "settlement_period_overlaps",
    });

    const result = await service.createSettlement("staff-1", {
      legalEntityId: ENTITY,
      reason: REASON,
    });

    expect(result).toEqual({ ok: false, reason: "settlement_period_overlaps" });
  });
});
