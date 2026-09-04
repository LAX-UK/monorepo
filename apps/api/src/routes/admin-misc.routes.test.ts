import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";
const targetUserId = "00000000-0000-4000-8000-0000000000b1";
const entityId = "00000000-0000-4000-8000-000000000001";
const sellerId = "00000000-0000-4000-8000-0000000000c1";

function createMiscContainer(partial: {
  ops?: Partial<Container["admin"]["ops"]>;
  users?: Partial<Container["admin"]["users"]>;
  catalog?: Partial<Container["admin"]["catalog"]>;
  stripeConnect?: Partial<Container["admin"]["stripeConnect"]>;
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test", WEB_ORIGIN: "http://localhost:3000" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      ops: partial.ops,
      users: partial.users,
      catalog: partial.catalog,
      stripeConnect: partial.stripeConnect,
    },
  } as unknown as Container;
}

describe("admin misc routes (DIP facade)", () => {
  it("GET /submissions/quality-gaps-count uses admin.ops", async () => {
    const countQualityGapsForAdminApi = vi.fn().mockResolvedValue(7);
    const container = createMiscContainer({
      ops: { countQualityGapsForAdminApi } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "specialist",
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/submissions/quality-gaps-count");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { count: 7 } });
    expect(countQualityGapsForAdminApi).toHaveBeenCalledOnce();
  });

  it("GET /submissions/count-by-sellers uses admin.ops", async () => {
    const countSubmissionsBySellersForAdminApi = vi.fn().mockResolvedValue(3);
    const container = createMiscContainer({
      ops: { countSubmissionsBySellersForAdminApi } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "specialist",
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/submissions/count-by-sellers?sellerIds=${sellerId}`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { count: 3 } });
    expect(countSubmissionsBySellersForAdminApi).toHaveBeenCalledWith([sellerId]);
  });

  it("PATCH /users/:userId/profile uses admin.users.updateProfileName", async () => {
    const updateProfileName = vi.fn().mockResolvedValue(undefined);
    const container = createMiscContainer({
      users: { updateProfileName } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.write"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/users/${targetUserId}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateProfileName).toHaveBeenCalledWith(targetUserId, "Updated Name");
  });

  it("GET /platform-catalog/legal-entity-id uses admin.catalog", async () => {
    const resolvePlatformCatalogLegalEntityId = vi
      .fn()
      .mockResolvedValue("30000000-0000-4000-9000-000000000001");
    const container = createMiscContainer({
      catalog: { resolvePlatformCatalogLegalEntityId } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "catalogue_manager",
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/platform-catalog/legal-entity-id");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { id: "30000000-0000-4000-9000-000000000001" },
    });
    expect(resolvePlatformCatalogLegalEntityId).toHaveBeenCalledOnce();
  });

  it("POST /legal-entities/:id/stripe-connect/sync uses admin.stripeConnect", async () => {
    const syncAccountFromStripe = vi
      .fn()
      .mockResolvedValue({ ready: true, stripeAccountId: "acct_1" });
    const container = createMiscContainer({
      stripeConnect: { syncAccountFromStripe } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.write"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/legal-entities/${entityId}/stripe-connect/sync`,
      { method: "POST" },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { ready: true, stripeAccountId: "acct_1" },
    });
    expect(syncAccountFromStripe).toHaveBeenCalledWith(entityId);
  });
});
