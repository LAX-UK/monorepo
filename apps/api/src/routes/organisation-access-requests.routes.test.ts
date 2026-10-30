import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationAccessRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { ACCESS_ACCOUNT, buildAccessRequestService } from "../testing/in-memory-access-requests.js";
import { createOrganisationAccessRequestRoutes } from "./organisation-access-requests.js";

function mount(built: ReturnType<typeof buildAccessRequestService>, role: LegalEntityMemberRole) {
  const context: LegalEntityContext = {
    legalEntityId: ACCESS_ACCOUNT,
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
    organisationAccess: { accessRequests: built.service },
  } as unknown as ContainerOrganisationAccessRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: context.userId, role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationAccessRequestRoutes(container, authenticator));
  return app;
}

const post = (app: Hono, path: string, json: unknown) =>
  app.request(`/legal-entities${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

const ROLES = ["owner", "admin", "finance", "consignor", "viewer", "buyer_agent"] as const;

describe("access request routes: capability matrix", () => {
  /** Who may decide a viewer's request: the people who run the organisation. */
  const DECIDE: Record<LegalEntityMemberRole, number> = {
    owner: 200,
    admin: 200,
    finance: 403,
    consignor: 403,
    viewer: 403,
    buyer_agent: 403,
  };

  for (const role of ROLES) {
    it(`approve answers ${DECIDE[role]} for ${role}`, async () => {
      const built = buildAccessRequestService();
      const asked = await post(mount(built, "viewer"), "/access-requests", {
        role: "buyer_agent",
        reason: "I bid at the Spring sale",
      });
      const { data } = (await asked.json()) as { data: { id: string } };
      const res = await post(mount(built, role), `/access-requests/${data.id}/approve`, {});
      // The viewer is the requester, so they are refused as such.
      expect(res.status).toBe(role === "viewer" ? 403 : DECIDE[role]);
    });
  }

  for (const role of ROLES.filter((r) => r !== "owner")) {
    it(`lets a ${role} ask for the owner role`, async () => {
      const res = await post(mount(buildAccessRequestService(), role), "/access-requests", {
        role: "owner",
        reason: "To run the account",
      });
      expect(res.status).toBe(201);
    });
  }
});

describe("access request routes", () => {
  it("answers 201 for a new request and 200 for the same ask again", async () => {
    const built = buildAccessRequestService();
    const app = mount(built, "finance");
    const body = { capability: "entity.bid.place", reason: "To bid for the gallery" };
    expect((await post(app, "/access-requests", body)).status).toBe(201);
    expect((await post(app, "/access-requests", body)).status).toBe(200);
    expect(built.store.rows).toHaveLength(1);
  });

  it("rejects an ask with both a role and a capability, or no reason", async () => {
    const app = mount(buildAccessRequestService(), "viewer");
    expect(
      (
        await post(app, "/access-requests", {
          role: "admin",
          capability: "entity.bid.place",
          reason: "both",
        })
      ).status,
    ).toBe(400);
    expect((await post(app, "/access-requests", { role: "admin" })).status).toBe(400);
  });

  it("lists every request for a decider and only their own for a member", async () => {
    const built = buildAccessRequestService();
    await post(mount(built, "viewer"), "/access-requests", { role: "admin", reason: "Help out" });
    await post(mount(built, "finance"), "/access-requests", { role: "admin", reason: "Help out" });
    const all = (await (
      await mount(built, "owner").request("/legal-entities/access-requests")
    ).json()) as {
      data: unknown[];
    };
    const own = (await (
      await mount(built, "viewer").request("/legal-entities/access-requests")
    ).json()) as {
      data: unknown[];
    };
    expect(all.data).toHaveLength(2);
    expect(own.data).toHaveLength(1);
  });
});
