import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ENDED_SALE_ID,
  ENTITY_ID,
  OPEN_SALE_ID,
  buildBuyerAgentAuthorisationService,
} from "../../testing/in-memory-buyer-agent-authorisations.js";
import type { BuyerAgentManager } from "../interfaces/buyer-agent-authorisation-service.js";

const owner: BuyerAgentManager = {
  kind: "member",
  userId: "owner-1",
  legalEntityId: ENTITY_ID,
  role: "owner",
};
const staff: BuyerAgentManager = { kind: "staff", userId: "staff-1" };

const allSales = {
  memberUserId: "agent-1",
  saleId: null,
  bidLimit: 10000,
  validFrom: null,
  validUntil: null,
};

describe("BuyerAgentAuthorisationService.authorise", () => {
  it("authorises a buyer agent for all sales and records who did it", async () => {
    const { service, publish } = buildBuyerAgentAuthorisationService();

    const result = await service.authorise(owner, ENTITY_ID, allSales);

    expect(result._unsafeUnwrap()).toMatchObject({
      userId: "agent-1",
      saleId: null,
      bidLimit: "10000.00",
      status: "active",
      validFrom: "2026-10-27T12:00:00.000Z",
      scheduled: false,
      expired: false,
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "legal_entity",
        aggregateId: ENTITY_ID,
        eventType: "legal_entity.buyer_agent_authorised",
        actorUserId: "owner-1",
        actingLegalEntityId: ENTITY_ID,
        payload: expect.objectContaining({
          member_user_id: "agent-1",
          sale_id: null,
          bid_limit: "10000.00",
          granted_by: "member",
          superseded_authorisation_id: null,
        }),
      }),
    );
  });

  it("lets owners and admins authorise, and nobody else", async () => {
    for (const role of legalEntityMemberRoles) {
      const { service, publish } = buildBuyerAgentAuthorisationService();
      const result = await service.authorise({ ...owner, role }, ENTITY_ID, allSales);
      const allowed = role === "owner" || role === "admin";
      expect(result.isOk()).toBe(allowed);
      if (!allowed) {
        expect(result._unsafeUnwrapErr()).toMatchObject({ code: "forbidden", status: 403 });
        expect(publish).not.toHaveBeenCalled();
      }
    }
  });

  it("refuses an impersonating admin", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const result = await service.authorise(
      { ...owner, isImpersonation: true },
      ENTITY_ID,
      allSales,
    );
    expect(result._unsafeUnwrapErr().code).toBe("forbidden");
  });

  it("refuses a member acting for another organisation", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const result = await service.authorise(
      { ...owner, legalEntityId: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
      ENTITY_ID,
      allSales,
    );
    expect(result._unsafeUnwrapErr().code).toBe("forbidden");
  });

  it("only authorises members with the buyer agent role who have joined", async () => {
    const { service } = buildBuyerAgentAuthorisationService([
      { userId: "owner-1", role: "owner" },
      { userId: "viewer-1", role: "viewer" },
      { userId: "invited-agent", role: "buyer_agent", accepted: false },
    ]);
    for (const memberUserId of ["viewer-1", "owner-1", "invited-agent", "stranger"]) {
      const result = await service.authorise(owner, ENTITY_ID, { ...allSales, memberUserId });
      expect(result._unsafeUnwrapErr().code).toBe("member_not_buyer_agent");
    }
  });

  it("limits an authorisation to an open sale only", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const open = await service.authorise(owner, ENTITY_ID, { ...allSales, saleId: OPEN_SALE_ID });
    expect(open._unsafeUnwrap()).toMatchObject({
      saleId: OPEN_SALE_ID,
      saleTitle: "Modern British",
    });

    const ended = await service.authorise(owner, ENTITY_ID, { ...allSales, saleId: ENDED_SALE_ID });
    expect(ended._unsafeUnwrapErr().code).toBe("sale_not_open");
  });

  it("refuses an end date that has passed", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const result = await service.authorise(owner, ENTITY_ID, {
      ...allSales,
      validUntil: "2026-10-01T00:00:00Z",
    });
    expect(result._unsafeUnwrapErr().code).toBe("invalid_window");
  });

  it("marks an authorisation that starts later as scheduled", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const result = await service.authorise(owner, ENTITY_ID, {
      ...allSales,
      validFrom: "2026-11-01T00:00:00Z",
      validUntil: "2026-12-01T00:00:00Z",
    });
    expect(result._unsafeUnwrap()).toMatchObject({ scheduled: true, expired: false });
  });

  it("replaces an earlier authorisation for the same scope", async () => {
    const { service, store, publish } = buildBuyerAgentAuthorisationService();
    const first = (await service.authorise(owner, ENTITY_ID, allSales))._unsafeUnwrap();
    await service.authorise(owner, ENTITY_ID, { ...allSales, bidLimit: 25000 });

    expect(store.rows.map((r) => [r.status, r.bidLimit])).toEqual([
      ["revoked", "10000.00"],
      ["active", "25000.00"],
    ]);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ superseded_authorisation_id: first.id }),
      }),
    );
  });

  it("lets staff authorise and records them as staff", async () => {
    const { service, publish } = buildBuyerAgentAuthorisationService();
    const result = await service.authorise(staff, ENTITY_ID, allSales);
    expect(result.isOk()).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "staff-1",
        actingLegalEntityId: null,
        payload: expect.objectContaining({ granted_by: "staff" }),
      }),
    );
  });
});

describe("BuyerAgentAuthorisationService.revoke", () => {
  it("revokes with a reason and audits it", async () => {
    const { service, publish } = buildBuyerAgentAuthorisationService();
    const granted = (await service.authorise(owner, ENTITY_ID, allSales))._unsafeUnwrap();

    const result = await service.revoke(owner, ENTITY_ID, granted.id, "Left the gallery");

    expect(result._unsafeUnwrap()).toMatchObject({
      status: "revoked",
      revokedReason: "Left the gallery",
    });
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.buyer_agent_authorisation_revoked",
        actorUserId: "owner-1",
        payload: expect.objectContaining({
          authorisation_id: granted.id,
          member_user_id: "agent-1",
          reason: "Left the gallery",
          revoked_by: "member",
        }),
      }),
    );
  });

  it("refuses a viewer", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const granted = (await service.authorise(owner, ENTITY_ID, allSales))._unsafeUnwrap();
    const result = await service.revoke({ ...owner, role: "viewer" }, ENTITY_ID, granted.id, "No");
    expect(result._unsafeUnwrapErr().code).toBe("forbidden");
  });

  it("reports an unknown or already revoked authorisation", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const missing = await service.revoke(
      owner,
      ENTITY_ID,
      "99999999-9999-4999-8999-999999999999",
      "Gone",
    );
    expect(missing._unsafeUnwrapErr()).toMatchObject({
      code: "authorisation_not_found",
      status: 404,
    });

    const granted = (await service.authorise(owner, ENTITY_ID, allSales))._unsafeUnwrap();
    await service.revoke(owner, ENTITY_ID, granted.id, "Once");
    const again = await service.revoke(owner, ENTITY_ID, granted.id, "Twice");
    expect(again._unsafeUnwrapErr()).toMatchObject({ code: "already_revoked", status: 409 });
  });
});

describe("BuyerAgentAuthorisationService.overview", () => {
  it("lists joined buyer agents, authorisations and open sales for managers", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    await service.authorise(owner, ENTITY_ID, allSales);

    const overview = (await service.overview(owner, ENTITY_ID))._unsafeUnwrap();

    expect(overview.canManage).toBe(true);
    expect(overview.buyerAgents).toEqual([
      { userId: "agent-1", name: "agent-1", email: "agent-1@example.test" },
    ]);
    expect(overview.authorisations).toHaveLength(1);
    expect(overview.sales.map((s) => s.id)).toEqual([OPEN_SALE_ID]);
  });

  it("lets an impersonating admin read but not manage", async () => {
    const { service } = buildBuyerAgentAuthorisationService();
    const overview = await service.overview({ ...owner, isImpersonation: true }, ENTITY_ID);
    expect(overview._unsafeUnwrap().canManage).toBe(false);
  });

  it.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
    "hides it from %s",
    async (role) => {
      const { service } = buildBuyerAgentAuthorisationService();
      const overview = await service.overview({ ...owner, role }, ENTITY_ID);
      expect(overview._unsafeUnwrapErr().code).toBe("forbidden");
    },
  );
});
