import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";

function mountApp(staffRole: string | null) {
  const invitations = {
    getPage: vi.fn(),
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
    c.set("userStaffRole", staffRole);
    await next();
  });
  attachAdminInvitationRoutes(app, invitations as never);
  return { app, invitations };
}

describe("admin invitation routes — list page", () => {
  it("returns paginated rows with summary meta", async () => {
    const { app, invitations } = mountApp("super_admin");
    invitations.getPage.mockResolvedValue({
      rows: [{ id: "inv-1", email: "alice@example.com", status: "pending" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: {
        total: 5,
        pending: 3,
        accepted: 2,
      },
    });

    const res = await app.request("http://test/invitations?limit=25&offset=0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      meta: { total: number; summary: { pending: number; accepted: number } };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.summary.pending).toBe(3);
    expect(body.meta.summary.accepted).toBe(2);
    expect(invitations.getPage).toHaveBeenCalledOnce();
  });

  it("GET /invitations returns 403 for specialist without user.invite", async () => {
    const { app, invitations } = mountApp("specialist");
    const res = await app.request("http://test/invitations");
    expect(res.status).toBe(403);
    expect(invitations.getPage).not.toHaveBeenCalled();
  });

  it("returns filter-coherent summary meta when status filter is applied", async () => {
    const { app, invitations } = mountApp("super_admin");
    invitations.getPage.mockResolvedValue({
      rows: [{ id: "inv-1", email: "alice@example.com", status: "pending" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: { total: 1, pending: 1, accepted: 0 },
    });

    const res = await app.request("http://test/invitations?status=pending&limit=25&offset=0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      meta: { summary: { total: number; pending: number; accepted: number } };
    };
    expect(body.meta.summary).toEqual({ total: 1, pending: 1, accepted: 0 });
    expect(invitations.getPage).toHaveBeenCalledWith(
      { status: "pending" },
      { limit: 25, offset: 0 },
    );
  });
});
