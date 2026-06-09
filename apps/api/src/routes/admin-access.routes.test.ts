import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  requireAnalytics,
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

function createAccessTestApp(middleware: MiddlewareHandler, staffRole: string | null) {
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-user-id");
    c.set("userRole", "staff");
    c.set("userStaffRole", staffRole);
    await next();
  });
  app.get("/test", middleware, (c) => c.json({ ok: true }));
  return app;
}

describe("admin access middleware", () => {
  it("requireUsersDirectory returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireUsersDirectory, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireUsersDirectory allows super_admin", async () => {
    const app = createAccessTestApp(requireUsersDirectory, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireUsersDirectory allows client_advisor", async () => {
    const app = createAccessTestApp(requireUsersDirectory, "client_advisor");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireAnalytics returns 403 for specialist", async () => {
    const app = createAccessTestApp(requireAnalytics, "specialist");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireAnalytics allows super_admin", async () => {
    const app = createAccessTestApp(requireAnalytics, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireSubmissionsAccess returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireSubmissionsAccess, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireSubmissionsAccess allows specialist", async () => {
    const app = createAccessTestApp(requireSubmissionsAccess, "specialist");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireCategoriesAccess returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireCategoriesAccess, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireCategoriesAccess allows catalogue_manager", async () => {
    const app = createAccessTestApp(requireCategoriesAccess, "catalogue_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireVenuesAccess returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireVenuesAccess, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireVenuesAccess allows catalogue_manager", async () => {
    const app = createAccessTestApp(requireVenuesAccess, "catalogue_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireArtistsAccess allows specialist with artist.read", async () => {
    const app = createAccessTestApp(requireArtistsAccess, "specialist");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireArtistsAccess returns 403 for finance_ops", async () => {
    const app = createAccessTestApp(requireArtistsAccess, "finance_ops");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireQrCodesAccess returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireQrCodesAccess, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireQrCodesAccess allows catalogue_manager", async () => {
    const app = createAccessTestApp(requireQrCodesAccess, "catalogue_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireLotsAccess returns 403 for staff_viewer", async () => {
    const app = createAccessTestApp(requireLotsAccess, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireLotsAccess allows auction_manager", async () => {
    const app = createAccessTestApp(requireLotsAccess, "auction_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requirePlatformAdminFull returns 403 for specialist", async () => {
    const app = createAccessTestApp(requirePlatformAdminFull, "specialist");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requirePlatformAdminFull allows super_admin", async () => {
    const app = createAccessTestApp(requirePlatformAdminFull, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailAdmin returns 403 for catalogue_manager", async () => {
    const app = createAccessTestApp(requireEmailAdmin, "catalogue_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireEmailAdmin allows super_admin", async () => {
    const app = createAccessTestApp(requireEmailAdmin, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailObservability allows content_marketing", async () => {
    const app = createAccessTestApp(requireEmailObservability, "content_marketing");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireEmailObservability returns 403 for catalogue_manager", async () => {
    const app = createAccessTestApp(requireEmailObservability, "catalogue_manager");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientBids allows client_advisor", async () => {
    const app = createAccessTestApp(requireClientBids, "client_advisor");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireClientBids returns 403 for operations", async () => {
    const app = createAccessTestApp(requireClientBids, "operations");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientKyc returns 403 for client_advisor (PII stays platform-admin only)", async () => {
    const app = createAccessTestApp(requireClientKyc, "client_advisor");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientKyc allows super_admin", async () => {
    const app = createAccessTestApp(requireClientKyc, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireClientActivity returns 403 for client_advisor", async () => {
    const app = createAccessTestApp(requireClientActivity, "client_advisor");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(403);
  });

  it("requireClientActivity allows super_admin", async () => {
    const app = createAccessTestApp(requireClientActivity, "super_admin");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });

  it("requireAuditDomainEvents allows staff_viewer", async () => {
    const app = createAccessTestApp(requireAuditDomainEvents, "staff_viewer");
    const res = await app.request("http://test/test");
    expect(res.status).toBe(200);
  });
});

describe("admin invitation routes", () => {
  it("GET /invitations returns 403 for specialist without user.invite", async () => {
    const invitations = {
      listInvitationsForActor: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
      resend: vi.fn(),
      preview: vi.fn(),
    };
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "staff-user-id");
      c.set("userRole", "staff");
      c.set("userStaffRole", "specialist");
      await next();
    });
    attachAdminInvitationRoutes(app, invitations as never);
    const res = await app.request("http://test/invitations");
    expect(res.status).toBe(403);
    expect(invitations.listInvitationsForActor).not.toHaveBeenCalled();
  });

  it("GET /invitations allows super_admin", async () => {
    const invitations = {
      listInvitationsForActor: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      revoke: vi.fn(),
      resend: vi.fn(),
      preview: vi.fn(),
    };
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "staff-user-id");
      c.set("userRole", "staff");
      c.set("userStaffRole", "super_admin");
      await next();
    });
    attachAdminInvitationRoutes(app, invitations as never);
    const res = await app.request("http://test/invitations");
    expect(res.status).toBe(200);
    expect(invitations.listInvitationsForActor).toHaveBeenCalledOnce();
  });
});
