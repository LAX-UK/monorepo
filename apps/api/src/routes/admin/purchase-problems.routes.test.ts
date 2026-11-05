import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminPurchaseProblemRoutes } from "./purchase-problems.routes.js";

const ID = "00000000-0000-4000-8000-000000000007";

function createApp(staffRoles: StaffRoles | undefined) {
  const purchaseProblems = {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    detail: vi.fn().mockResolvedValue({ id: ID, status: "open" }),
    update: vi.fn().mockResolvedValue({ ok: true, problem: { id: ID, status: "in_progress" } }),
    assignees: vi.fn().mockResolvedValue([{ id: "u1", name: "Sofia Okafor" }]),
  };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminPurchaseProblemRoutes(app as never, { admin: { purchaseProblems } } as never);
  return { app, purchaseProblems };
}

const patch = (body: unknown) => ({
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("GET /purchase-problems", () => {
  it.each(["client_services", "administrator"] as const)("lists for %s", async (role) => {
    const { app, purchaseProblems } = createApp([role]);
    const res = await app.request(
      `http://test/purchase-problems?status=in_progress&saleId=${ID}&q=PR-3F&page=2&limit=10`,
    );
    expect(res.status).toBe(200);
    expect(purchaseProblems.list).toHaveBeenCalledWith({
      status: "in_progress",
      saleId: ID,
      q: "PR-3F",
      page: 2,
      limit: 10,
    });
  });

  it("opens on the open status with a page of 25", async () => {
    const { app, purchaseProblems } = createApp(["client_services"]);
    await app.request("http://test/purchase-problems");
    expect(purchaseProblems.list).toHaveBeenCalledWith({ status: "open", page: 1, limit: 25 });
  });

  it("rejects a status or sale that does not exist", async () => {
    const { app, purchaseProblems } = createApp(["administrator"]);
    expect((await app.request("http://test/purchase-problems?status=closed")).status).toBe(400);
    expect((await app.request("http://test/purchase-problems?saleId=nope")).status).toBe(400);
    expect(purchaseProblems.list).not.toHaveBeenCalled();
  });
});

describe("GET /purchase-problems/:id", () => {
  it("returns the report", async () => {
    const { app, purchaseProblems } = createApp(["client_services"]);
    expect((await app.request(`http://test/purchase-problems/${ID}`)).status).toBe(200);
    expect(purchaseProblems.detail).toHaveBeenCalledWith(ID);
  });

  it("answers 404 for a report that does not exist", async () => {
    const { app, purchaseProblems } = createApp(["administrator"]);
    purchaseProblems.detail.mockResolvedValue(null);
    expect((await app.request(`http://test/purchase-problems/${ID}`)).status).toBe(404);
  });

  it("rejects an id that is not a uuid", async () => {
    const { app } = createApp(["administrator"]);
    expect((await app.request("http://test/purchase-problems/PR-3F2A9C1E")).status).toBe(400);
  });
});

describe("PATCH /purchase-problems/:id", () => {
  it("applies the change as the signed-in person", async () => {
    const { app, purchaseProblems } = createApp(["client_services"]);
    const res = await app.request(
      `http://test/purchase-problems/${ID}`,
      patch({ version: 2, status: "resolved", note: "Refunded in full." }),
    );
    expect(res.status).toBe(200);
    expect(purchaseProblems.update).toHaveBeenCalledWith("staff-1", ID, {
      version: 2,
      status: "resolved",
      note: "Refunded in full.",
    });
  });

  it("answers 409 with the current version for a stale write", async () => {
    const { app, purchaseProblems } = createApp(["client_services"]);
    purchaseProblems.update.mockResolvedValue({
      ok: false,
      error: "stale_version",
      currentVersion: 4,
    });
    const res = await app.request(
      `http://test/purchase-problems/${ID}`,
      patch({ version: 3, note: "x" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stale_version", currentVersion: 4 });
  });

  it.each([
    ["purchase_problem_not_found", 404],
    ["assignee_invalid", 422],
    ["not_allowed", 422],
    ["resolution_note_required", 422],
    ["unchanged", 422],
  ])("answers %s with %i", async (error, status) => {
    const { app, purchaseProblems } = createApp(["client_services"]);
    purchaseProblems.update.mockResolvedValue({ ok: false, error });
    const res = await app.request(
      `http://test/purchase-problems/${ID}`,
      patch({ version: 1, status: "resolved", note: "x" }),
    );
    expect(res.status).toBe(status);
  });

  it.each([
    ["no version", { status: "in_progress" }],
    ["nothing to change", { version: 1 }],
    ["an unknown status", { version: 1, status: "closed" }],
    ["a blank note", { version: 1, note: "   " }],
  ])("rejects %s", async (_label, body) => {
    const { app, purchaseProblems } = createApp(["administrator"]);
    expect((await app.request(`http://test/purchase-problems/${ID}`, patch(body))).status).toBe(
      400,
    );
    expect(purchaseProblems.update).not.toHaveBeenCalled();
  });
});

describe("GET /purchase-problem-assignees", () => {
  it("names the staff a report may be given to", async () => {
    const { app } = createApp(["client_services"]);
    const res = await app.request("http://test/purchase-problem-assignees");
    expect(await res.json()).toEqual({ data: { assignees: [{ id: "u1", name: "Sofia Okafor" }] } });
  });
});

describe("who may open the purchase problem routes", () => {
  it.each([
    ["finance"],
    ["read_only"],
    ["sales_manager"],
    ["specialist"],
    ["cataloguer"],
    ["fulfilment"],
    ["compliance"],
    ["saleroom_clerk"],
  ] as const)("refuses %s everywhere", async (role) => {
    const { app, purchaseProblems } = createApp([role]);
    for (const [path, init] of [
      ["/purchase-problems", undefined],
      [`/purchase-problems/${ID}`, undefined],
      [`/purchase-problems/${ID}`, patch({ version: 1, note: "x" })],
      ["/purchase-problem-assignees", undefined],
    ] as const) {
      expect((await app.request(`http://test${path}`, init)).status).toBe(403);
    }
    expect(purchaseProblems.list).not.toHaveBeenCalled();
    expect(purchaseProblems.detail).not.toHaveBeenCalled();
    expect(purchaseProblems.update).not.toHaveBeenCalled();
    expect(purchaseProblems.assignees).not.toHaveBeenCalled();
  });
});
