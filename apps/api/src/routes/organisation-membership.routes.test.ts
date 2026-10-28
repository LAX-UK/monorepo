import type { StoppedMemberBids } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationMembershipRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { MemberWelcomeService } from "../services/organisation-membership/member-welcome.service.js";
import { StoppedMemberBidsQuery } from "../services/organisation-membership/stopped-member-bids.query.js";
import { createOrganisationMembershipRoutes } from "./organisation-membership.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const STOPPED: StoppedMemberBids = {
  memberUserId: "sam",
  memberName: "Sam Lee",
  stoppedAt: new Date("2026-10-28T09:00:00Z"),
  bids: [
    {
      kind: "auto_bid",
      lotId: "l1",
      lotTitle: "Harbour at Dusk",
      lotNumber: 14,
      maxAmount: "6200.00",
    },
  ],
};

function mount(role: LegalEntityMemberRole) {
  const context: LegalEntityContext = {
    legalEntityId: ENTITY,
    userId: "member-1",
    role,
    isPrimaryAdmin: role === "owner",
  };
  const dismiss = vi.fn(async () => true);
  const listSince = vi.fn(async () => [STOPPED]);
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
      stoppedMemberBids: new StoppedMemberBidsQuery({ listSince }),
    },
  } as unknown as ContainerOrganisationMembershipRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "member-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationMembershipRoutes(container, authenticator));
  return { app, dismiss, listSince };
}

describe("organisation membership routes", () => {
  it("dismisses the welcome card for the member's own membership", async () => {
    const { app, dismiss } = mount("consignor");
    const res = await app.request("/legal-entities/membership/welcome-dismissal", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(dismiss).toHaveBeenCalledWith("member-1", ENTITY, expect.any(Date));
  });

  it.each(["owner", "admin"] as const)(
    "shows a %s what stopped when members left",
    async (role) => {
      const { app, listSince } = mount(role);
      const res = await app.request("/legal-entities/stopped-member-bids");
      expect(res.status).toBe(200);
      expect(((await res.json()) as { data: unknown[] }).data).toHaveLength(1);
      expect(listSince).toHaveBeenCalledWith(ENTITY, expect.any(Date));
    },
  );

  it.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
    "refuses a %s with 403",
    async (role) => {
      const { app, listSince } = mount(role);
      expect((await app.request("/legal-entities/stopped-member-bids")).status).toBe(403);
      expect(listSince).not.toHaveBeenCalled();
    },
  );
});
