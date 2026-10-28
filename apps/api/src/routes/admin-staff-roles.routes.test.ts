import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InMemoryIdempotencyStore, stubStepUpGuard } from "../testing/staff-mutation-guards.js";
import { createAdminRoutes } from "./admin.js";

function buildApp(options: { staffRoles?: StaffRoles; recent?: boolean } = {}) {
  const staffRoles = {
    overview: vi
      .fn()
      .mockResolvedValue(ok({ userId: "usr_a", assignments: [], otherActiveAdministrators: 1 })),
    assign: vi.fn().mockResolvedValue(ok(undefined)),
    remove: vi.fn().mockResolvedValue(
      err({
        status: 409,
        code: "last_administrator",
        message: "They are the only administrator. Give someone else the administrator role first.",
      }),
    ),
    accessReview: vi.fn().mockResolvedValue([]),
  };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      staffTwoFactorPolicy: { readStaffPolicy: vi.fn(), setStaffPolicy: vi.fn() },
      staffAccess: {},
      staffRoles,
      stepUp: stubStepUpGuard(options.recent ?? true),
      idempotencyStore: new InMemoryIdempotencyStore(),
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_admin",
      role: "staff",
      staffRoles: options.staffRoles ?? ["administrator"],
      scopes: ["bid.read", "bid.write"],
      identitySessionId: "session-1",
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, staffRoles };
}

const request = (method: string, body?: unknown) => ({
  method,
  headers: { cookie: "better-auth.session_token=test", "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("admin staff roles routes", () => {
  it("gives a role with its end date and reason", async () => {
    const { app, staffRoles } = buildApp();
    const res = await app.request(
      "/admin/staff/usr_a/roles",
      request("POST", {
        role: "fulfilment",
        endsAt: "2026-12-01T00:00:00.000Z",
        reason: "Winter sale cover",
      }),
    );
    expect(res.status).toBe(200);
    expect(staffRoles.assign).toHaveBeenCalledWith({
      userId: "usr_a",
      actorUserId: "usr_admin",
      role: "fulfilment",
      endsAt: new Date("2026-12-01T00:00:00.000Z"),
      reason: "Winter sale cover",
    });
  });

  it("returns the role rule's code and sentence when a removal is refused", async () => {
    const { app } = buildApp();
    const res = await app.request(
      "/admin/staff/usr_a/roles/remove",
      request("POST", { role: "administrator", reason: "Leaving LAX" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "They are the only administrator. Give someone else the administrator role first.",
      code: "last_administrator",
    });
  });

  it("asks for a reason", async () => {
    const { app, staffRoles } = buildApp();
    const res = await app.request(
      "/admin/staff/usr_a/roles",
      request("POST", { role: "fulfilment", reason: "" }),
    );
    expect(res.status).toBe(400);
    expect(staffRoles.assign).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in before a role change", async () => {
    const { app, staffRoles } = buildApp({ recent: false });
    const res = await app.request(
      "/admin/staff/usr_a/roles",
      request("POST", { role: "fulfilment", reason: "Cover" }),
    );
    expect(res.status).toBe(403);
    expect(staffRoles.assign).not.toHaveBeenCalled();
  });

  it("lets read-only staff read the access review and roles but change nothing", async () => {
    const { app, staffRoles } = buildApp({ staffRoles: ["read_only"] });
    expect((await app.request("/admin/staff/access-review", request("GET"))).status).toBe(200);
    expect((await app.request("/admin/staff/usr_a/roles", request("GET"))).status).toBe(200);
    const change = await app.request(
      "/admin/staff/usr_a/roles",
      request("POST", { role: "fulfilment", reason: "Cover" }),
    );
    expect(change.status).toBe(403);
    expect(staffRoles.assign).not.toHaveBeenCalled();
  });

  it("keeps the access review from roles without staff access", async () => {
    const { app } = buildApp({ staffRoles: ["saleroom_clerk"] });
    expect((await app.request("/admin/staff/access-review", request("GET"))).status).toBe(403);
  });
});
