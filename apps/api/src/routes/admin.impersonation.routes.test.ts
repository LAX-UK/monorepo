import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const adminUserId = "admin-user-id";
const entityId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("admin impersonation routes", () => {
  it("POST /impersonation/start delegates to IAdminImpersonationService", async () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";
    const expiresAt = new Date("2099-06-01T12:00:00.000Z");

    const startImpersonation = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        actingCookie: "test-cookie-b64",
        sessionId,
        expiresAt: expiresAt.toISOString(),
        displayName: "Test Org",
      },
    });

    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
        impersonation: {
          startImpersonation,
          lookupForImpersonation: vi.fn(),
          endImpersonation: vi.fn(),
          recordFailedEnd: vi.fn(),
        },
      },
    } as unknown as Container;

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: adminUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.write"],
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "" },
      body: JSON.stringify({ legalEntityId: entityId }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { actingCookie: string; sessionId: string; expiresAt: string; displayName: string };
    };
    expect(body.data.sessionId).toBe(sessionId);
    expect(body.data.displayName).toBe("Test Org");
    expect(body.data.actingCookie).toBe("test-cookie-b64");
    expect(startImpersonation).toHaveBeenCalledWith({
      actorUserId: adminUserId,
      legalEntityId: entityId,
      cookieHeader: "",
    });
  });
});
