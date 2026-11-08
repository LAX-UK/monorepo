import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

function buildApp(who: { role: string; staffRoles: string[]; recent: boolean }) {
  const isRecent = vi.fn().mockResolvedValue(who.recent);
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      stepUp: { isRecent },
      staffTwoFactorPolicy: {
        readStaffPolicy: vi.fn(),
        setStaffPolicy: vi.fn().mockResolvedValue({ policy: {}, coverage: {} }),
      },
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_1",
      identitySessionId: "session-1",
      role: who.role,
      staffRoles: normalizeStaffRoles(who.staffRoles),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, isRecent };
}

const post = (app: Hono, path: string, body: unknown = {}) =>
  app.request(`http://test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const code = async (res: Response) => ((await res.json()) as { code?: string }).code;

describe("step-up gate order on the admin app", () => {
  const dangerous = "/admin/compliance/aml/screenings/s1/decide";

  it("answers forbidden, not step_up_required, to a non-staff user, and never calls Identity", async () => {
    const { app, isRecent } = buildApp({ role: "client", staffRoles: [], recent: false });
    const res = await post(app, dangerous);
    expect(res.status).toBe(403);
    expect(await code(res)).not.toBe("step_up_required");
    expect(isRecent).not.toHaveBeenCalled();
  });

  it("answers forbidden to staff with no admin access, and never calls Identity", async () => {
    const { app, isRecent } = buildApp({ role: "staff", staffRoles: [], recent: false });
    const res = await post(app, dangerous);
    expect(res.status).toBe(403);
    expect(await code(res)).not.toBe("step_up_required");
    expect(isRecent).not.toHaveBeenCalled();
  });

  it("still demands a fresh sign-in from an administrator on the same path", async () => {
    const { app, isRecent } = buildApp({
      role: "staff",
      staffRoles: ["administrator"],
      recent: false,
    });
    const res = await post(app, dangerous);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("step_up_required");
    expect(isRecent).toHaveBeenCalledTimes(1);
  });
});

describe("the gate covers the staff-role, bid-limit and goods-release routes", () => {
  it.each([
    "/admin/invitations",
    "/admin/invitations/bulk",
    "/admin/sales/s1/telephone-bookings/b1/approve-limit-increase",
    "/admin/lot-fulfilment/l1/release",
  ])("a stale session is stopped on POST %s", async (path) => {
    const { app, isRecent } = buildApp({
      role: "staff",
      staffRoles: ["administrator"],
      recent: false,
    });
    const res = await post(app, path);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("step_up_required");
    expect(isRecent).toHaveBeenCalledTimes(1);
  });
});

describe("the gate and the router read the same path", () => {
  const variants = [
    "/admin/users/u1/suspend",
    "/admin/users/u1/suspend/",
    "/admin/users/u%31/suspend",
    "/admin/users/a%2Fb/suspend",
    "/admin/users/%75%31/suspend/",
  ];

  it.each(variants)("a stale session is stopped on %s before the router", async (path) => {
    const { app, isRecent } = buildApp({
      role: "staff",
      staffRoles: ["administrator"],
      recent: false,
    });
    const res = await post(app, path);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("step_up_required");
    expect(isRecent).toHaveBeenCalledTimes(1);
  });

  it("a fresh session reaches the router on the exact path", async () => {
    const { app, isRecent } = buildApp({
      role: "staff",
      staffRoles: ["administrator"],
      recent: true,
    });
    const res = await app.request("http://test/admin/security/staff-two-factor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: "not-a-boolean" }),
    });
    expect(res.status).toBe(400);
    expect(isRecent).toHaveBeenCalledTimes(1);
  });

  it("a trailing slash is never looser than the router: the gate still asks, the router does not serve it", async () => {
    const stale = buildApp({ role: "staff", staffRoles: ["administrator"], recent: false });
    const refused = await stale.app.request("http://test/admin/security/staff-two-factor/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: false }),
    });
    expect(await code(refused)).toBe("step_up_required");
    const fresh = buildApp({ role: "staff", staffRoles: ["administrator"], recent: true });
    const served = await fresh.app.request("http://test/admin/security/staff-two-factor/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: false }),
    });
    expect(served.status).toBe(404);
  });

  it("does not let an encoded slash turn a different route into a dangerous one or hide one", async () => {
    const { app, isRecent } = buildApp({
      role: "staff",
      staffRoles: ["administrator"],
      recent: false,
    });
    const res = await post(app, "/admin/users/u1%2Fsuspend");
    expect(res.status).toBe(404);
    expect(isRecent).not.toHaveBeenCalled();
  });
});
