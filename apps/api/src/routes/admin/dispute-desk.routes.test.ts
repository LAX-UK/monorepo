import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { requireFinanceAccess } from "../../middleware/require-capability.js";
import type { IAdminDisputeDeskService } from "../../services/interfaces/admin-routes/admin-compliance-routes.js";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminDisputeDeskRoutes } from "./dispute-desk.routes.js";

const CASE_ID = "5b0f3a50-1f43-4f63-9f2b-5e8f3f7f1a10";
const PAYMENT_ID = "8f0a3c10-1f43-4f63-9f2b-5e8f3f7f1a22";

const counts = { needs_allocation: 1, open: 2, under_review: 0, closed: 0, all: 2 };

function build(options: { staffRoles?: StaffRoles; recent?: boolean; desk?: object } = {}) {
  const desk = {
    listCases: vi.fn().mockResolvedValue({ rows: [], hasNextPage: false, counts }),
    getCase: vi.fn().mockResolvedValue({ id: CASE_ID }),
    allocate: vi.fn().mockResolvedValue(ok({ caseId: CASE_ID, version: 2 })),
    ...options.desk,
  };
  const app: AdminHono = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("identitySessionId", "session-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", options.staffRoles ?? ["finance"]);
    await next();
  });
  app.use("/finance/*", requireFinanceAccess);
  attachAdminDisputeDeskRoutes(
    app,
    { admin: { disputeDesk: desk as unknown as IAdminDisputeDeskService } } as never,
    createTestStaffGuards({ recent: options.recent ?? true }),
  );
  return { app, desk };
}

const body = {
  expectedVersion: 3,
  lines: [{ paymentId: PAYMENT_ID, amountPence: 4_800_00 }],
  note: "The buyer confirmed all three lots were on one charge.",
};

function allocate(app: AdminHono, payload: unknown = body, key = "key-0001-allocate") {
  return app.request(`/finance/dispute-cases/${CASE_ID}/allocation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}

describe("GET /finance/dispute-cases", () => {
  it("lists a view with its search and filters, and the count of every view", async () => {
    const { app, desk } = build();
    const res = await app.request(
      "/finance/dispute-cases?view=needs_allocation&q=Hartley&reason=fraudulent&limit=20&offset=40",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], hasNextPage: false, counts });
    expect(desk.listCases).toHaveBeenCalledWith({
      view: "needs_allocation",
      q: "Hartley",
      reason: "fraudulent",
      limit: 20,
      offset: 40,
    });
  });

  it("defaults to every case, 50 at a time", async () => {
    const { app, desk } = build();
    await app.request("/finance/dispute-cases");
    expect(desk.listCases).toHaveBeenCalledWith({ view: "all", limit: 50, offset: 0 });
  });

  it("refuses an unknown view", async () => {
    const { app } = build();
    expect((await app.request("/finance/dispute-cases?view=nope")).status).toBe(400);
  });

  it("is closed to staff without finance access", async () => {
    const { app } = build({ staffRoles: ["sales_manager"] });
    expect((await app.request("/finance/dispute-cases")).status).toBe(403);
  });
});

describe("GET /finance/dispute-cases/:id", () => {
  it("returns the case", async () => {
    const { app } = build();
    const res = await app.request(`/finance/dispute-cases/${CASE_ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: CASE_ID } });
  });

  it("answers 404 when there is no such case", async () => {
    const { app } = build({ desk: { getCase: vi.fn().mockResolvedValue(null) } });
    expect((await app.request(`/finance/dispute-cases/${CASE_ID}`)).status).toBe(404);
  });

  it("refuses an id that is not a case id", async () => {
    const { app } = build();
    expect((await app.request("/finance/dispute-cases/dp_123")).status).toBe(400);
  });
});

describe("POST /finance/dispute-cases/:id/allocation", () => {
  it("allocates as the signed-in person and returns the new version", async () => {
    const { app, desk } = build();
    const res = await allocate(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { caseId: CASE_ID, version: 2 } });
    expect(desk.allocate).toHaveBeenCalledWith({
      caseId: CASE_ID,
      expectedVersion: 3,
      lines: body.lines,
      note: body.note,
      actorUserId: "staff-1",
    });
  });

  it("is closed to finance read-only roles", async () => {
    const { app, desk } = build({ staffRoles: ["sales_manager"] });
    expect((await allocate(app)).status).toBe(403);
    expect(desk.allocate).not.toHaveBeenCalled();
  });

  it("asks for a recent sign-in before allocating", async () => {
    const { app, desk } = build({ recent: false });
    expect((await allocate(app)).status).toBe(403);
    expect(desk.allocate).not.toHaveBeenCalled();
  });

  it("requires a reason of at least ten characters and at least one line", async () => {
    const { app, desk } = build();
    expect((await allocate(app, { ...body, note: "short" })).status).toBe(400);
    expect((await allocate(app, { ...body, lines: [] }, "key-0002-allocate")).status).toBe(400);
    expect(desk.allocate).not.toHaveBeenCalled();
  });

  it.each([
    ["version_conflict", 409],
    ["already_allocated", 409],
    ["not_found", 404],
    ["total_mismatch", 422],
    ["not_a_candidate", 422],
  ] as const)("answers %s with %s and a message", async (reason, status) => {
    const { app } = build({ desk: { allocate: vi.fn().mockResolvedValue(err(reason)) } });
    const res = await allocate(app);
    expect(res.status).toBe(status);
    const json = (await res.json()) as { error: string; code: string };
    expect(json.code).toBe(reason);
    expect(json.error.length).toBeGreaterThan(10);
  });
});
