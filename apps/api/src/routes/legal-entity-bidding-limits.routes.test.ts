import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityBuyerAgentRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { ENTITY_ID } from "../testing/in-memory-buyer-agent-authorisations.js";
import { buildOrganisationBiddingLimitsService } from "../testing/in-memory-organisation-bidding-limits.js";
import { createLegalEntityBiddingLimitRoutes } from "./legal-entity-bidding-limits.js";

function mount(role: LegalEntityMemberRole) {
  const built = buildOrganisationBiddingLimitsService();
  const context: LegalEntityContext = {
    legalEntityId: ENTITY_ID,
    userId: `${role}-1`,
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
    buyerAgents: { limits: built.service },
  } as unknown as ContainerLegalEntityBuyerAgentRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: context.userId, role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createLegalEntityBiddingLimitRoutes(container, authenticator));
  return { app, ...built };
}

const put = (app: Hono, json: unknown) =>
  app.request("/legal-entities/bidding-limits/organisation", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

describe("organisation bidding limit routes", () => {
  it("lets an owner set the limit and read it back with what is in use", async () => {
    const { app, publish } = mount("owner");

    const set = await put(app, { limit: 250_000 });
    expect(set.status).toBe(200);

    const read = await app.request("/legal-entities/bidding-limits");
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      data: {
        canManage: true,
        organisation: { limit: "250000.00", exposure: "30000.00", available: "220000.00" },
      },
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("lets a buyer agent read the limits but not change them", async () => {
    const { app, limits } = mount("buyer_agent");
    expect((await app.request("/legal-entities/bidding-limits")).status).toBe(200);
    const res = await put(app, { limit: 1000 });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "forbidden" });
    expect(limits.rows.size).toBe(0);
  });

  it.each(["finance", "viewer", "consignor"] as const)("refuses a %s", async (role) => {
    const { app } = mount(role);
    expect((await app.request("/legal-entities/bidding-limits")).status).toBe(403);
  });

  it.each([{ limit: 0 }, { limit: -1 }, { limit: 10.001 }, {}, { limit: 5, extra: true }])(
    "rejects %o",
    async (body) => {
      const { app } = mount("owner");
      expect((await put(app, body)).status).toBe(400);
    },
  );

  it("removes the limit with null", async () => {
    const { app, limits } = mount("admin");
    await put(app, { limit: 5000 });
    expect((await put(app, { limit: null })).status).toBe(200);
    expect(limits.rows.size).toBe(0);
  });
});
