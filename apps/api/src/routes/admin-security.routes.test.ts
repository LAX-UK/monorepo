import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

function buildApp(staffRole: string) {
  const twoFactorPolicy = {
    readStaffPolicy: vi.fn().mockResolvedValue({
      policy: { required: true, setBySubjectId: null, setAt: null },
      coverage: { members: 4, enrolled: 3 },
    }),
    setStaffPolicy: vi.fn().mockResolvedValue({
      policy: { required: false, setBySubjectId: "usr_admin", setAt: null },
      coverage: { members: 4, enrolled: 3 },
    }),
  };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      staffTwoFactorPolicy: twoFactorPolicy,
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_admin",
      role: "staff",
      staffRole,
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, twoFactorPolicy };
}

describe("admin staff two-factor policy routes", () => {
  it("lets a super admin read and change the staff policy", async () => {
    const { app, twoFactorPolicy } = buildApp("super_admin");

    const read = await app.request("http://test/admin/security/staff-two-factor");
    expect(read.status).toBe(200);
    expect(((await read.json()) as { data: { coverage: unknown } }).data.coverage).toEqual({
      members: 4,
      enrolled: 3,
    });

    const write = await app.request("http://test/admin/security/staff-two-factor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: false }),
    });
    expect(write.status).toBe(200);
    expect(twoFactorPolicy.setStaffPolicy).toHaveBeenCalledWith("usr_admin", false);
  });

  it("forbids staff without full platform admin access", async () => {
    const { app, twoFactorPolicy } = buildApp("specialist");
    const res = await app.request("http://test/admin/security/staff-two-factor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: false }),
    });
    expect(res.status).toBe(403);
    expect(twoFactorPolicy.setStaffPolicy).not.toHaveBeenCalled();
  });
});
