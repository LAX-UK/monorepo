import type { LegalEntityMemberRole, StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityBuyerAgentRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { BidAuthorityQueryService } from "../services/buyer-agents/buyer-agent-authorisation.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { fakeBidAuthority } from "../testing/fake-bid-authority.js";
import {
  ENTITY_ID,
  OPEN_SALE_ID,
  buildBuyerAgentAuthorisationService,
} from "../testing/in-memory-buyer-agent-authorisations.js";
import type { AdminHono } from "./admin/_shared.js";
import { attachAdminLegalEntityBuyerAgentRoutes } from "./admin/legal-entity-buyer-agents.routes.js";
import { createLegalEntityBuyerAgentRoutes } from "./legal-entity-buyer-agents.js";

const body = {
  memberUserId: "agent-1",
  saleId: OPEN_SALE_ID,
  bidLimit: 5000,
  validFrom: null,
  validUntil: "2026-12-31T23:59:00Z",
};

function mountClient(role: LegalEntityMemberRole, bidRole: LegalEntityMemberRole | null = role) {
  const built = buildBuyerAgentAuthorisationService();
  const context: LegalEntityContext = {
    legalEntityId: ENTITY_ID,
    userId: "owner-1",
    role,
    isPrimaryAdmin: role === "owner",
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    buyerAgents: {
      authorisations: built.service,
      bidAuthority: new BidAuthorityQueryService(
        fakeBidAuthority(bidRole, [{ saleId: OPEN_SALE_ID, bidLimit: "5000.00" }]),
      ),
    },
  } as unknown as ContainerLegalEntityBuyerAgentRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "owner-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createLegalEntityBuyerAgentRoutes(container, authenticator));
  return { app, ...built };
}

function post(app: Hono, path: string, json: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

describe("client buyer-agent authorisation routes", () => {
  it("lets an owner authorise and then revoke, with audit events", async () => {
    const { app, publish } = mountClient("owner");

    const created = await post(app, "/legal-entities/buyer-agent-authorisations", body);
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string; bidLimit: string } };
    expect(data.bidLimit).toBe("5000.00");

    const revoked = await post(
      app,
      `/legal-entities/buyer-agent-authorisations/${data.id}/revoke`,
      { reason: "No longer buying for us" },
    );
    expect(revoked.status).toBe(200);
    expect(publish.mock.calls.map(([event]) => event.eventType)).toEqual([
      "legal_entity.buyer_agent_authorised",
      "legal_entity.buyer_agent_authorisation_revoked",
    ]);
  });

  it.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
    "refuses a %s with 403 and writes nothing",
    async (role) => {
      const { app, store, publish } = mountClient(role);

      const res = await post(app, "/legal-entities/buyer-agent-authorisations", body);

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "forbidden" });
      expect(store.rows).toEqual([]);
      expect(publish).not.toHaveBeenCalled();
      expect((await app.request("/legal-entities/buyer-agent-authorisations")).status).toBe(403);
    },
  );

  it("rejects a limit that is not a positive amount", async () => {
    const { app } = mountClient("owner");
    const res = await post(app, "/legal-entities/buyer-agent-authorisations", {
      ...body,
      bidLimit: -5,
    });
    expect(res.status).toBe(400);
  });

  it("rejects an end before the start", async () => {
    const { app } = mountClient("owner");
    const res = await post(app, "/legal-entities/buyer-agent-authorisations", {
      ...body,
      validFrom: "2026-12-01T00:00:00Z",
      validUntil: "2026-11-01T00:00:00Z",
    });
    expect(res.status).toBe(400);
  });

  it("requires a reason to revoke", async () => {
    const { app } = mountClient("owner");
    const res = await post(
      app,
      "/legal-entities/buyer-agent-authorisations/00000000-0000-4000-8000-000000000001/revoke",
      { reason: "" },
    );
    expect(res.status).toBe(400);
  });

  it("answers whether the member may bid for the organisation in a sale", async () => {
    const agent = mountClient("buyer_agent");
    const allowed = await agent.app.request(`/legal-entities/bid-authority?saleId=${OPEN_SALE_ID}`);
    expect(await allowed.json()).toEqual({
      data: { allowed: true, role: "buyer_agent", viaAuthorisation: true, bidLimit: "5000.00" },
    });

    const viewer = mountClient("viewer");
    const refused = await viewer.app.request(
      `/legal-entities/bid-authority?saleId=${OPEN_SALE_ID}`,
    );
    expect(await refused.json()).toEqual({
      data: { allowed: false, role: "viewer", reason: "role_cannot_bid" },
    });
  });
});

function mountAdmin(staffRoles: StaffRoles | undefined) {
  const built = buildBuyerAgentAuthorisationService();
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminLegalEntityBuyerAgentRoutes(platform, built.service);
  const app = new Hono();
  app.route("/admin", platform);
  return { app, ...built };
}

describe("admin buyer-agent authorisation routes", () => {
  const base = `/admin/legal-entities/${ENTITY_ID}/buyer-agent-authorisations`;

  it("lets an auction manager authorise and records the staff actor", async () => {
    const { app, publish } = mountAdmin(["auction_manager"]);

    const res = await post(app, base, body);

    expect(res.status).toBe(201);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "staff-1",
        payload: expect.objectContaining({ granted_by: "staff" }),
      }),
    );
  });

  it("lets read-only staff see but not change authorisations", async () => {
    const { app, store } = mountAdmin(["staff_viewer"]);

    expect((await app.request(base)).status).toBe(200);
    expect((await post(app, base, body)).status).toBe(403);
    expect(store.rows).toEqual([]);
  });

  it("forbids staff without legal entity access", async () => {
    const { app } = mountAdmin(["content_marketing"]);
    expect((await app.request(base)).status).toBe(403);
  });
});
