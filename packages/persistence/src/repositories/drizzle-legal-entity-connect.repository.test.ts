import { PayHoldTransitionRefusedError } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { DrizzleLegalEntityConnectRepository } from "./drizzle-legal-entity-connect.repository.js";

const flags = {
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectRequirementsErrors: [],
  stripeConnectDisabledReason: null,
};

function dbWithUpdate() {
  const returning = vi.fn().mockResolvedValue([{ id: "le-1" }]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { update } as never, update };
}

describe("DrizzleLegalEntityConnectRepository.applyConnectStatusTransition", () => {
  it("refuses a pay-allowed to held change before writing", async () => {
    const { db, update } = dbWithUpdate();
    const repo = new DrizzleLegalEntityConnectRepository(db);

    await expect(
      repo.applyConnectStatusTransition({
        legalEntityId: "le-1",
        expectedStatus: "approved",
        nextStatus: "archived",
        flags,
      }),
    ).rejects.toBeInstanceOf(PayHoldTransitionRefusedError);
    expect(update).not.toHaveBeenCalled();
  });

  it("still applies approved -> connect_pending", async () => {
    const { db, update } = dbWithUpdate();
    const repo = new DrizzleLegalEntityConnectRepository(db);

    const row = await repo.applyConnectStatusTransition({
      legalEntityId: "le-1",
      expectedStatus: "approved",
      nextStatus: "connect_pending",
      flags,
    });

    expect(row).toEqual({ id: "le-1" });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
