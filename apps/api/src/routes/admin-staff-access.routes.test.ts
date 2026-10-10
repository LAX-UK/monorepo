import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

function buildApp() {
  const staffAccess = {
    summaries: vi.fn().mockResolvedValue(ok([])),
    detail: vi.fn().mockResolvedValue(ok({ subjectId: "usr_a", platforms: [], history: [] })),
    setRemoteRole: vi.fn().mockResolvedValue(err({ status: 400, message: "unknown_shop_role" })),
    revokeRemote: vi.fn().mockResolvedValue(ok({ subjectId: "usr_a", platforms: [], history: [] })),
  };
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
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_admin",
      role: "staff",
      staffRole: "super_admin",
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, staffAccess };
}

const ACTOR = { userId: "usr_admin", role: "staff", staffRole: "super_admin" };
const json = (method: string, body?: unknown) => ({
  method,
  headers: {
    cookie: "better-auth.session_token=test",
    "content-type": "application/json",
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("admin staff access routes", () => {
  it("reads summaries for the signed-in admin", async () => {
    const { app, staffAccess } = buildApp();

    const res = await app.request(
      "/admin/staff/access/summaries",
      json("POST", { subjectIds: ["usr_a", "usr_b"] }),
    );

    expect(res.status).toBe(200);
    expect(staffAccess.summaries).toHaveBeenCalledWith(ACTOR, ["usr_a", "usr_b"]);
  });

  it("maps service errors to their status", async () => {
    const { app } = buildApp();

    const res = await app.request("/admin/staff/usr_a/access/shop", json("PUT", { role: "x" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown_shop_role" });
  });

  it("only accepts remote platforms; Bid roles change through the staff-role endpoint", async () => {
    const { app, staffAccess } = buildApp();

    const res = await app.request("/admin/staff/usr_a/access/bid", json("DELETE"));

    expect(res.status).toBe(400);
    expect(staffAccess.revokeRemote).not.toHaveBeenCalled();
  });
});
