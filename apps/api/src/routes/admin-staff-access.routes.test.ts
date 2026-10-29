import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InMemoryIdempotencyStore, stubStepUpGuard } from "../testing/staff-mutation-guards.js";
import { createAdminRoutes } from "./admin.js";

function buildApp(options: { recent?: boolean } = {}) {
  const staffAccess = {
    summaries: vi.fn().mockResolvedValue(ok([])),
    detail: vi.fn().mockResolvedValue(ok({ subjectId: "usr_a", platforms: [], history: [] })),
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
      stepUp: stubStepUpGuard(options.recent ?? true),
      idempotencyStore: new InMemoryIdempotencyStore(),
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_admin",
      role: "staff",
      staffRoles: ["administrator"],
      scopes: ["bid.read", "bid.write"],
      identitySessionId: "session-1",
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, staffAccess };
}

const ACTOR = { userId: "usr_admin", role: "staff", staffRoles: ["administrator"] };
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

  it("no longer changes another platform's role here; LAX Admin roles have their own endpoints", async () => {
    const { app } = buildApp();

    const put = await app.request("/admin/staff/usr_a/access/shop", json("PUT", { role: "x" }));
    const del = await app.request("/admin/staff/usr_a/access/shop", json("DELETE"));

    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
  });

  it("still reads access without a recent sign-in", async () => {
    const { app } = buildApp({ recent: false });

    const res = await app.request("/admin/staff/usr_a/access", json("GET"));

    expect(res.status).toBe(200);
  });
});
