import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ENTITY_ID,
  type InMemoryBuyerAgentAuthorisations,
  NOW,
  OPEN_SALE_ID,
} from "../../testing/in-memory-buyer-agent-authorisations.js";
import { buildOrganisationBiddingLimitsService as buildLimitsService } from "../../testing/in-memory-organisation-bidding-limits.js";
import type { BuyerAgentManager } from "../interfaces/buyer-agent-authorisation-service.js";

const member = (role: LegalEntityMemberRole, userId = `${role}-1`): BuyerAgentManager => ({
  kind: "member",
  userId,
  legalEntityId: ENTITY_ID,
  role,
});

async function grant(store: InMemoryBuyerAgentAuthorisations, userId: string, total: string) {
  await store.grant(
    {
      legalEntityId: ENTITY_ID,
      userId,
      saleId: OPEN_SALE_ID,
      bidLimit: "5000.00",
      totalLimit: total,
      validFrom: new Date("2026-10-01"),
      validUntil: null,
      createdByUserId: "owner-1",
    },
    "Replaced",
  );
}

describe("OrganisationBiddingLimitsService", () => {
  it("shows owners the organisation limit and each agent's total with its use", async () => {
    const { service, limits, authorisations } = buildLimitsService();
    await limits.set({
      legalEntityId: ENTITY_ID,
      limitAmount: "250000.00",
      setByUserId: "owner-1",
    });
    await grant(authorisations, "agent-1", "12000.00");

    const view = (await service.view(member("owner"), ENTITY_ID))._unsafeUnwrap();

    expect(view.canManage).toBe(true);
    // One lot counts once at its largest commitment: 9000 + 1000 + 20000.
    expect(view.organisation).toEqual({
      limit: "250000.00",
      exposure: "30000.00",
      available: "220000.00",
      updatedAt: NOW.toISOString(),
    });
    expect(view.authorisations).toEqual([
      expect.objectContaining({
        userId: "agent-1",
        saleId: OPEN_SALE_ID,
        bidLimit: "5000.00",
        // Only the agent's commitments in this sale count against a sale's total.
        total: { limit: "12000.00", exposure: "9000.00", available: "3000.00" },
      }),
    ]);
  });

  it("shows exposure with no limits set", async () => {
    const { service } = buildLimitsService();
    const view = (await service.view(member("admin"), ENTITY_ID))._unsafeUnwrap();
    expect(view.organisation).toEqual({
      limit: null,
      exposure: "30000.00",
      available: null,
      updatedAt: null,
    });
  });

  it("shows a buyer agent only their own authorisations and no way to change the limit", async () => {
    const { service, authorisations } = buildLimitsService();
    await grant(authorisations, "agent-1", "12000.00");
    await grant(authorisations, "agent-2", "8000.00");

    const view = (await service.view(member("buyer_agent", "agent-2"), ENTITY_ID))._unsafeUnwrap();

    expect(view.canManage).toBe(false);
    expect(view.authorisations.map((a) => a.userId)).toEqual(["agent-2"]);
  });

  it.each(["finance", "consignor", "viewer"] as const)("refuses a %s", async (role) => {
    const { service } = buildLimitsService();
    expect((await service.view(member(role), ENTITY_ID))._unsafeUnwrapErr().status).toBe(403);
  });

  it("refuses a member of another organisation", async () => {
    const { service } = buildLimitsService();
    const outsider = { ...member("owner"), legalEntityId: "other-org" };
    expect((await service.view(outsider, ENTITY_ID)).isErr()).toBe(true);
  });

  it("lets owners and admins set, lower and remove the limit, recording each change", async () => {
    const { service, publish } = buildLimitsService();

    await service.setOrganisationLimit(member("owner"), ENTITY_ID, { limit: 250_000 });
    const lowered = await service.setOrganisationLimit(member("admin"), ENTITY_ID, {
      limit: 25_000,
    });
    // Lowered below what is already committed: nothing is cancelled, no room is left.
    expect(lowered._unsafeUnwrap().organisation).toMatchObject({
      limit: "25000.00",
      available: "0.00",
    });
    await service.setOrganisationLimit(member("owner"), ENTITY_ID, { limit: null });

    expect(publish.mock.calls.map(([e]) => e.payload)).toEqual([
      { previous_limit: null, limit: "250000.00", changed_by: "member" },
      { previous_limit: "250000.00", limit: "25000.00", changed_by: "member" },
      { previous_limit: "25000.00", limit: null, changed_by: "member" },
    ]);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      eventType: "legal_entity.bidding_limit_changed",
      aggregateId: ENTITY_ID,
      actorUserId: "owner-1",
      actingLegalEntityId: ENTITY_ID,
    });
  });

  it("records nothing when the limit does not change", async () => {
    const { service, publish } = buildLimitsService();
    await service.setOrganisationLimit(member("owner"), ENTITY_ID, { limit: null });
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["buyer_agent", "finance", "viewer"] as const)(
    "refuses a %s changing the limit and writes nothing",
    async (role) => {
      const { service, limits, publish } = buildLimitsService();
      const result = await service.setOrganisationLimit(member(role), ENTITY_ID, { limit: 1 });
      expect(result._unsafeUnwrapErr()).toMatchObject({ code: "forbidden", status: 403 });
      expect(limits.rows.size).toBe(0);
      expect(publish).not.toHaveBeenCalled();
    },
  );
});
