import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { StaffAccessAdminService } from "../services/admin/staff-access-admin.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminMyStaffToolsRoutes } from "./admin/staff-access.routes.js";

const SUBJECT = "8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const T0 = new Date("2026-10-10T10:00:00.000Z");

type SessionUser = { role: string; staffRoles: StaffRoles | undefined };

function buildApp(
  session: SessionUser | null,
  directory: { product: "bid" | "shop"; role: string }[],
  scopes: string[] = ["bid.read", "bid.write"],
) {
  const access = {
    listForSubjects: vi.fn(async () =>
      directory.map((d) => ({ subjectId: SUBJECT, ...d, updatedAt: T0 })),
    ),
    history: vi.fn(async () => []),
    requestGrant: vi.fn(async () => {}),
    requestRevoke: vi.fn(async () => {}),
  };
  const staffAccess = new StaffAccessAdminService({
    access,
    users: { getById: vi.fn(), getByIds: vi.fn() } as never,
    identity: { readSecuritySummaries: vi.fn() } as never,
  });
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      staffTwoFactorPolicy: { readStaffPolicy: vi.fn(), setStaffPolicy: vi.fn() },
      staffAccess,
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(
      session && {
        id: SUBJECT,
        ...session,
        scopes,
      },
    ),
  };
  const app = new Hono();
  app.route("/admin/staff/my-tools", createAdminMyStaffToolsRoutes(container, authenticator));
  return app;
}

const request = (app: Hono) =>
  app.request("/admin/staff/my-tools", { headers: { cookie: "better-auth.session_token=test" } });

describe("GET /admin/staff/my-tools", () => {
  it("lists both tools for a Bid super admin who also holds a Shop role", async () => {
    const app = buildApp({ role: "staff", staffRoles: ["super_admin"] }, [
      { product: "bid", role: "super_admin" },
      { product: "shop", role: "shop_admin" },
    ]);

    const res = await request(app);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { tools: ["bid-admin", "lax-admin"] } });
  });

  it("lists only Bid admin for Bid staff without a Shop role", async () => {
    const app = buildApp({ role: "staff", staffRoles: ["specialist"] }, [
      { product: "bid", role: "specialist" },
    ]);

    expect(await (await request(app)).json()).toEqual({ data: { tools: ["bid-admin"] } });
  });

  it("answers finance staff, who fail the platform shell gate but open Bid admin", async () => {
    const app = buildApp({ role: "staff", staffRoles: ["finance_ops"] }, [
      { product: "bid", role: "finance_ops" },
    ]);

    const res = await request(app);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { tools: ["bid-admin"] } });
  });

  it("follows the live Bid session rather than a stale directory row", async () => {
    const app = buildApp({ role: "client", staffRoles: [] }, [
      { product: "bid", role: "specialist" },
    ]);

    expect(await (await request(app)).json()).toEqual({ data: { tools: [] } });
  });

  it("lists only LAX Admin for Shop-only staff", async () => {
    const app = buildApp({ role: "staff", staffRoles: [] }, [{ product: "shop", role: "broker" }]);

    expect(await (await request(app)).json()).toEqual({ data: { tools: ["lax-admin"] } });
  });

  it("answers LAX Admin's exchanged token, which carries only the staff tools scope", async () => {
    const app = buildApp(
      { role: "staff", staffRoles: ["specialist"] },
      [{ product: "shop", role: "broker" }],
      ["lax.staff.tools.read"],
    );

    const res = await request(app);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { tools: ["bid-admin", "lax-admin"] } });
  });

  it("refuses tokens that carry neither bid.read nor the staff tools scope", async () => {
    for (const scopes of [["bid.write"], ["lax.portfolio.read"], []]) {
      const app = buildApp({ role: "staff", staffRoles: ["specialist"] }, [], scopes);

      const res = await request(app);

      expect(res.status).toBe(403);
    }
  });

  it("rejects a request with no session", async () => {
    const app = buildApp(null, []);

    const res = await request(app);

    expect(res.status).toBe(401);
  });
});
