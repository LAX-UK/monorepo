import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  PENDING_DELETION_GUARDED_ROUTES,
  createPendingDeletionGuard,
  mountPendingDeletionGuard,
} from "./pending-deletion-guard.js";

const REQUESTED_AT = new Date("2026-11-02T10:00:00Z");

function appWith(options: { user: { id: string } | null; requestedAt: Date | null }) {
  const reader = { requestedAt: vi.fn(async () => options.requestedAt) };
  const authenticator = { getSessionUser: vi.fn(async () => options.user as never) };
  const app = new Hono();
  mountPendingDeletionGuard(app, createPendingDeletionGuard({ authenticator, reader }));
  for (const route of PENDING_DELETION_GUARDED_ROUTES) {
    app.on(route.method, route.path, (c) => c.json({ reached: true }));
  }
  app.get("/lots/:id", (c) => c.json({ reached: true }));
  return { app, reader };
}

describe("pending deletion guard", () => {
  it("stops every commitment route and tells the person when they will be deleted", async () => {
    const { app } = appWith({ user: { id: "u1" }, requestedAt: REQUESTED_AT });
    for (const route of PENDING_DELETION_GUARDED_ROUTES) {
      const res = await app.request(route.path.replace(":id", "abc"), { method: route.method });
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
      expect(await res.json()).toEqual({
        error: "Your account is due to be deleted on 2 December. Cancel deletion to continue.",
        code: "account_deletion_pending",
        details: { dueOn: "2 December" },
        deletionDueAt: "2026-12-02T10:00:00.000Z",
      });
    }
  });

  it.each([
    ["POST", "/sales/s1/telephone-bookings"],
    ["POST", "/telephone-bookings/b1/limit-increase"],
    ["POST", "/submissions/x1/submit"],
    ["POST", "/submissions/x1/agreement/accept"],
  ])("stops %s %s", async (method, path) => {
    const { app } = appWith({ user: { id: "u1" }, requestedAt: REQUESTED_AT });
    expect((await app.request(path, { method })).status).toBe(403);
  });

  it.each([
    ["POST", "/submissions"],
    ["PATCH", "/submissions/x1"],
    ["POST", "/telephone-bookings/b1/cancel"],
    ["POST", "/legal-entities"],
  ])("leaves %s %s open", async (method, path) => {
    const { app, reader } = appWith({ user: { id: "u1" }, requestedAt: REQUESTED_AT });
    app.on(method, path, (c) => c.json({ reached: true }));
    expect((await app.request(path, { method })).status).toBe(200);
    expect(reader.requestedAt).not.toHaveBeenCalled();
  });

  it("lets a person with no request through", async () => {
    const { app } = appWith({ user: { id: "u1" }, requestedAt: null });
    const res = await app.request("/bids", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("leaves signed-out requests to the route's own authentication", async () => {
    const { app, reader } = appWith({ user: null, requestedAt: REQUESTED_AT });
    const res = await app.request("/bids", { method: "POST" });
    expect(res.status).toBe(200);
    expect(reader.requestedAt).not.toHaveBeenCalled();
  });

  it("does not touch reads", async () => {
    const { app, reader } = appWith({ user: { id: "u1" }, requestedAt: REQUESTED_AT });
    const res = await app.request("/lots/abc");
    expect(res.status).toBe(200);
    expect(reader.requestedAt).not.toHaveBeenCalled();
  });
});
