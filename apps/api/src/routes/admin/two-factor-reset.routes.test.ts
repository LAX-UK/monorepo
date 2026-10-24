import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AdminHono } from "./_shared.js";
import { attachAdminTwoFactorResetRoutes } from "./two-factor-reset.routes.js";

const TARGET_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const ACTOR_ID = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";
const REASON = "Customer lost phone and backup codes; identity checked by video call.";

/** The platform shell authenticates upstream; here a stub supplies the identity. */
function setup(session: { role: string; staffRole: string | null }) {
  const reset = vi.fn().mockResolvedValue({
    match: (ok: () => unknown) => ok(),
  });
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    c.set("userId", ACTOR_ID);
    c.set("userRole", session.role);
    c.set("userStaffRole", session.staffRole);
    await next();
  });
  attachAdminTwoFactorResetRoutes(platform, { reset });
  const app = new Hono();
  app.route("/admin", platform);
  const post = (body: unknown) =>
    app.request(`http://test/admin/users/${TARGET_ID}/two-factor/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { post, reset };
}

describe("POST /admin/users/:userId/two-factor/reset", () => {
  it.each([
    ["super admin", "super_admin"],
    ["support concierge", "support_concierge"],
  ])("lets a %s reset and passes the actor, target and reason on", async (_label, staffRole) => {
    const { post, reset } = setup({ role: "staff", staffRole });

    const res = await post({ reason: REASON });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(reset).toHaveBeenCalledWith(
      { userId: ACTOR_ID, role: "staff", staffRole },
      TARGET_ID,
      REASON,
    );
  });

  it.each([
    ["client advisor", "client_advisor"],
    ["finance ops", "finance_ops"],
    ["staff viewer", "staff_viewer"],
    ["compliance officer", "compliance_officer"],
  ])("refuses a %s", async (_label, staffRole) => {
    const { post, reset } = setup({ role: "staff", staffRole });

    const res = await post({ reason: REASON });

    expect(res.status).toBe(403);
    expect(reset).not.toHaveBeenCalled();
  });

  it("refuses a customer", async () => {
    const { post, reset } = setup({ role: "client", staffRole: null });

    const res = await post({ reason: REASON });

    expect(res.status).toBe(403);
    expect(reset).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "   " }],
    ["a one-word reason", { reason: "lost" }],
    ["an over-long reason", { reason: "x".repeat(501) }],
  ])("rejects %s", async (_label, body) => {
    const { post, reset } = setup({ role: "staff", staffRole: "super_admin" });

    const res = await post(body);

    expect(res.status).toBe(400);
    expect(reset).not.toHaveBeenCalled();
  });
});
