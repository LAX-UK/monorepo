import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDangerousStaffActionGate } from "./dangerous-staff-action-gate.js";
import { DANGEROUS_STAFF_ACTIONS } from "./dangerous-staff-actions.js";
import { createRequireRecentStaffAuth } from "./require-recent-staff-auth.js";

type Vars = {
  userId?: string;
  userRole?: string;
  userStaffRoles?: StaffRoles | undefined;
  identitySessionId?: string;
  staffStepUpVerified?: true;
};

function build(
  recent: boolean,
  enforce?: boolean,
  who: { role?: string; staff?: StaffRoles } = {},
) {
  const isRecent = vi.fn().mockResolvedValue(recent);
  const requireRecent = createRequireRecentStaffAuth({ isRecent });
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", who.role ?? "staff");
    c.set("userStaffRoles", who.staff ?? ["administrator"]);
    c.set("identitySessionId", "sid-1");
    await next();
  });
  app.use(
    "*",
    createDangerousStaffActionGate(requireRecent, enforce === undefined ? {} : { enforce }),
  );
  // A route that repeats the guard, as the existing admin routes do.
  app.post("/admin/payments/:id/refund-buyer", requireRecent, (c) => c.json({ ok: true }));
  app.post("/admin/compliance/aml/screenings/:id/decide", (c) => c.json({ ok: true }));
  app.post("/admin/saved-views/order", (c) => c.json({ ok: true }));
  return { app, isRecent };
}

const post = (app: Hono<{ Variables: Vars }>, path: string) =>
  app.request(path, { method: "POST" });

describe("createDangerousStaffActionGate", () => {
  it("lets a fresh session through a dangerous route", async () => {
    const { app } = build(true);
    expect((await post(app, "/admin/compliance/aml/screenings/s1/decide")).status).toBe(200);
  });

  it("answers 403 step_up_required for a stale session on a route with no guard of its own", async () => {
    const { app } = build(false);
    const res = await post(app, "/admin/compliance/aml/screenings/s1/decide");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("step_up_required");
  });

  it("refuses a stale session on a route that also carries its own guard", async () => {
    const { app } = build(false);
    expect((await post(app, "/admin/payments/p1/refund-buyer")).status).toBe(403);
  });

  it("asks Identity once when the route repeats the check", async () => {
    const { app, isRecent } = build(true);
    expect((await post(app, "/admin/payments/p1/refund-buyer")).status).toBe(200);
    expect(isRecent).toHaveBeenCalledTimes(1);
  });

  it("passes a non-staff user straight through without asking Identity", async () => {
    const { app, isRecent } = build(false, undefined, { role: "client", staff: [] });
    expect((await post(app, "/admin/compliance/aml/screenings/s1/decide")).status).toBe(200);
    expect(isRecent).not.toHaveBeenCalled();
  });

  it("passes staff with no admin access straight through without asking Identity", async () => {
    const { app, isRecent } = build(false, undefined, { role: "staff", staff: [] });
    expect((await post(app, "/admin/compliance/aml/screenings/s1/decide")).status).toBe(200);
    expect(isRecent).not.toHaveBeenCalled();
  });

  it("never touches routes that are not in the registry", async () => {
    const { app, isRecent } = build(false);
    expect((await post(app, "/admin/saved-views/order")).status).toBe(200);
    expect(isRecent).not.toHaveBeenCalled();
  });

  it("is a pass-through when enforcement is switched off", async () => {
    const { app } = build(false, false);
    expect((await post(app, "/admin/compliance/aml/screenings/s1/decide")).status).toBe(200);
  });

  it("guards every registry entry it is responsible for", async () => {
    const isRecent = vi.fn().mockResolvedValue(false);
    const gate = createDangerousStaffActionGate(createRequireRecentStaffAuth({ isRecent }));
    for (const action of DANGEROUS_STAFF_ACTIONS.filter((x) => x.enforcedBy === "gate")) {
      const app = new Hono<{ Variables: Vars }>();
      app.use("*", async (c, next) => {
        c.set("userId", "staff-1");
        c.set("userRole", "staff");
        c.set("userStaffRoles", ["administrator"]);
        c.set("identitySessionId", "sid-1");
        await next();
      });
      app.use("*", gate);
      app.all("*", (c) => c.json({ ok: true }));
      const res = await app.request(action.path.replace(/:[A-Za-z]+/g, "x1"), {
        method: action.method,
      });
      expect(res.status, action.id).toBe(403);
    }
  });
});
