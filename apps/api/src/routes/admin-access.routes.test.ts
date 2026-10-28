import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  requireArtistsAccess,
  requireAuditDomainEvents,
  requireCategoriesAccess,
  requireClientActivity,
  requireClientBids,
  requireClientKyc,
  requireEmailAdmin,
  requireEmailObservability,
  requireLotsAccess,
  requirePlatformAdminFull,
  requireQrCodesAccess,
  requireSubmissionsAccess,
  requireUsersDirectory,
  requireVenuesAccess,
} from "../middleware/require-capability.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";

function createAccessTestApp(middleware: MiddlewareHandler, staffRoles: StaffRoles | undefined) {
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-user-id");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  app.get("/test", middleware, (c) => c.json({ ok: true }));
  return app;
}

describe("admin access middleware", () => {
  it("requireUsersDirectory returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireUsersDirectory, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireUsersDirectory allows administrator", async () => {
    const app = createAccessTestApp(requireUsersDirectory, ["administrator"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireUsersDirectory allows client_services", async () => {
    const app = createAccessTestApp(requireUsersDirectory, ["client_services"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireSubmissionsAccess returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireSubmissionsAccess, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireSubmissionsAccess allows specialist", async () => {
    const app = createAccessTestApp(requireSubmissionsAccess, ["specialist"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireCategoriesAccess returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireCategoriesAccess, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireCategoriesAccess allows cataloguer", async () => {
    const app = createAccessTestApp(requireCategoriesAccess, ["cataloguer"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireVenuesAccess returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireVenuesAccess, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireVenuesAccess allows cataloguer", async () => {
    const app = createAccessTestApp(requireVenuesAccess, ["cataloguer"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireArtistsAccess allows specialist with artist.read", async () => {
    const app = createAccessTestApp(requireArtistsAccess, ["specialist"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireArtistsAccess returns 403 for finance", async () => {
    const app = createAccessTestApp(requireArtistsAccess, ["finance"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireQrCodesAccess returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireQrCodesAccess, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireQrCodesAccess allows cataloguer", async () => {
    const app = createAccessTestApp(requireQrCodesAccess, ["cataloguer"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireLotsAccess returns 403 for read_only", async () => {
    const app = createAccessTestApp(requireLotsAccess, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireLotsAccess allows sales_manager", async () => {
    const app = createAccessTestApp(requireLotsAccess, ["sales_manager"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requirePlatformAdminFull returns 403 for specialist", async () => {
    const app = createAccessTestApp(requirePlatformAdminFull, ["specialist"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requirePlatformAdminFull allows administrator", async () => {
    const app = createAccessTestApp(requirePlatformAdminFull, ["administrator"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailAdmin returns 403 for cataloguer", async () => {
    const app = createAccessTestApp(requireEmailAdmin, ["cataloguer"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireEmailAdmin allows administrator", async () => {
    const app = createAccessTestApp(requireEmailAdmin, ["administrator"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailObservability allows read_only", async () => {
    const app = createAccessTestApp(requireEmailObservability, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailObservability returns 403 for cataloguer", async () => {
    const app = createAccessTestApp(requireEmailObservability, ["cataloguer"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientBids allows client_services", async () => {
    const app = createAccessTestApp(requireClientBids, ["client_services"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireClientBids returns 403 for fulfilment", async () => {
    const app = createAccessTestApp(requireClientBids, ["fulfilment"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientKyc returns 403 for client_services (PII stays platform-admin only)", async () => {
    const app = createAccessTestApp(requireClientKyc, ["client_services"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientKyc allows administrator", async () => {
    const app = createAccessTestApp(requireClientKyc, ["administrator"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireClientActivity returns 403 for client_services", async () => {
    const app = createAccessTestApp(requireClientActivity, ["client_services"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientActivity allows administrator", async () => {
    const app = createAccessTestApp(requireClientActivity, ["administrator"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireAuditDomainEvents allows read_only", async () => {
    const app = createAccessTestApp(requireAuditDomainEvents, ["read_only"]);
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });
});

describe("admin invitation routes", () => {
  it("GET /invitations returns 403 for specialist without user.invite", async () => {
    const invitations = {
      getPage: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
      resend: vi.fn(),
      preview: vi.fn(),
    };
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "staff-user-id");
      c.set("userRole", "staff");
      c.set("userStaffRoles", ["specialist"]);
      await next();
    });
    attachAdminInvitationRoutes(app, invitations as never);
    const res = await app.request("http://test/invitations");
    expect(res.status).toBe(403);
    expect(invitations.getPage).not.toHaveBeenCalled();
  });

  it("GET /invitations allows administrator", async () => {
    const invitations = {
      getPage: vi.fn().mockResolvedValue({
        rows: [],
        total: 0,
        offset: 0,
        limit: 50,
        summary: { total: 0, pending: 0, accepted: 0 },
      }),
      create: vi.fn(),
      revoke: vi.fn(),
      resend: vi.fn(),
      preview: vi.fn(),
    };
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "staff-user-id");
      c.set("userRole", "staff");
      c.set("userStaffRoles", ["administrator"]);
      await next();
    });
    attachAdminInvitationRoutes(app, invitations as never);
    const res = await app.request("http://test/invitations");
    expect(res.status).toBe(200);
    expect(invitations.getPage).toHaveBeenCalledOnce();
  });
});
