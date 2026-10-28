import type { FormerMemberOpenBid } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationMembershipRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { FormerMemberBidsService } from "../services/organisation-membership/former-member-bids.service.js";
import { MemberWelcomeService } from "../services/organisation-membership/member-welcome.service.js";
import { createOrganisationMembershipRoutes } from "./organisation-membership.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const BID: FormerMemberOpenBid = {
  kind: "absentee",
  id: "00000000-0000-4000-8000-0000000000b2",
  lotId: "00000000-0000-4000-8000-0000000000a1",
  lotTitle: "Harbour at Dusk",
  lotNumber: 14,
  endsAt: new Date("2026-11-04T18:00:00Z"),
  memberUserId: "former-agent",
  memberName: "Sam Lee",
  maxAmount: "6200.00",
};

function mount(role: LegalEntityMemberRole) {
  const context: LegalEntityContext = {
    legalEntityId: ENTITY,
    userId: "member-1",
    role,
    isPrimaryAdmin: role === "owner",
  };
  const publish = vi.fn(async () => undefined);
  const sink = { publish, withTx: () => sink };
  const dismiss = vi.fn(async () => true);
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationMembership: {
      welcome: new MemberWelcomeService({ dismiss }),
      formerMemberBids: new FormerMemberBidsService({
        bids: {
          listForEntity: async () => [BID],
          listForMember: async () => [BID],
          cancel: async () => BID,
        },
        transactions: { runInTransaction: (fn) => fn({} as never) },
        events: sink,
        realtime: { notifyProxyCancelled: async () => undefined },
      }),
    },
  } as unknown as ContainerOrganisationMembershipRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "member-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationMembershipRoutes(container, authenticator));
  return { app, publish, dismiss };
}

function post(app: Hono, path: string, json?: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
}

const cancelBody = { kind: BID.kind, id: BID.id, memberUserId: BID.memberUserId };

describe("organisation membership routes", () => {
  it("dismisses the welcome card for the member's own membership", async () => {
    const { app, dismiss } = mount("consignor");
    const res = await post(app, "/legal-entities/membership/welcome-dismissal");
    expect(res.status).toBe(200);
    expect(dismiss).toHaveBeenCalledWith("member-1", ENTITY, expect.any(Date));
  });

  it("lists and cancels a former member's bid for an admin, with an audit event", async () => {
    const { app, publish } = mount("admin");
    const list = await app.request("/legal-entities/former-member-bids");
    expect(list.status).toBe(200);
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1);

    const res = await post(app, "/legal-entities/former-member-bids/cancel", cancelBody);
    expect(res.status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
    "refuses a %s with 403",
    async (role) => {
      const { app, publish } = mount(role);
      expect((await app.request("/legal-entities/former-member-bids")).status).toBe(403);
      const res = await post(app, "/legal-entities/former-member-bids/cancel", cancelBody);
      expect(res.status).toBe(403);
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed cancel request", async () => {
    const { app } = mount("owner");
    const res = await post(app, "/legal-entities/former-member-bids/cancel", { kind: "phone" });
    expect(res.status).toBe(400);
  });
});
