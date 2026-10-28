import { type StaffRoles, normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AdminHono } from "./_shared.js";
import { attachAdminAuditRoutes } from "./audit.routes.js";

const ACTOR_ID = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";

/** The platform shell authenticates upstream; here a stub supplies the identity. */
function setup(session: { role: string; staffRoles: StaffRoles | undefined }) {
  const search = vi.fn().mockResolvedValue({ rows: [], total: 0 });
  const searchActors = vi.fn().mockResolvedValue([]);
  const listRedacted = vi.fn().mockResolvedValue([]);
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    c.set("userId", ACTOR_ID);
    c.set("userRole", session.role);
    c.set("userStaffRoles", session.staffRoles);
    await next();
  });
  attachAdminAuditRoutes(platform, {
    admin: { auditLog: { search, searchActors }, domainEvents: { listRedacted } },
  } as never);
  const app = new Hono();
  app.route("/admin", platform);
  const get = (path: string) => app.request(`http://test/admin/audit${path}`);
  return { get, search, searchActors, listRedacted };
}

describe("GET /admin/audit/log and /admin/audit/actors", () => {
  it.each([
    ["administrator", "administrator"],
    ["finance ops", "finance"],
    ["read-only", "read_only"],
    ["sales manager", "sales_manager"],
  ])("lets a %s read the log and the actors", async (_label, staffRole) => {
    const { get, search, searchActors } = setup({
      role: "staff",
      staffRoles: normalizeStaffRoles([staffRole]),
    });

    expect((await get("/log")).status).toBe(200);
    expect((await get("/actors")).status).toBe(200);
    expect(search).toHaveBeenCalledOnce();
    expect(searchActors).toHaveBeenCalledOnce();
  });

  it.each([
    ["customer", "client", []],
    ["staff without a staff role", "staff", []],
  ])("refuses a %s", async (_label, role, staffRoles) => {
    const { get, search, searchActors } = setup({ role, staffRoles });

    expect((await get("/log")).status).toBe(403);
    expect((await get("/actors")).status).toBe(403);
    expect(search).not.toHaveBeenCalled();
    expect(searchActors).not.toHaveBeenCalled();
  });

  it("passes every filter to the service and returns its page", async () => {
    const { get, search } = setup({ role: "staff", staffRoles: ["administrator"] });
    search.mockResolvedValue({ rows: [{ id: "1" }], total: 41 });

    const res = await get(
      "/log?limit=25&offset=50&q=refund&actorUserId=u1&view=finance&eventTypes=payment.refunded,payout.paid&aggregateType=payment&aggregateId=p1&from=2026-10-01&to=2026-10-24",
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { rows: [{ id: "1" }], total: 41 } });
    expect(search).toHaveBeenCalledWith({
      limit: 25,
      offset: 50,
      includePii: false,
      q: "refund",
      actorUserId: "u1",
      view: "finance",
      eventTypes: ["payment.refunded", "payout.paid"],
      aggregateType: "payment",
      aggregateId: "p1",
      fromDay: "2026-10-01",
      toDay: "2026-10-24",
    });
  });

  it("passes a sort to the service and rejects an unknown one", async () => {
    const { get, search } = setup({ role: "staff", staffRoles: ["administrator"] });

    expect((await get("/log?sort=at_asc")).status).toBe(200);
    expect(search).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      includePii: false,
      sort: "at_asc",
    });

    search.mockClear();
    expect((await get("/log?sort=newest")).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("defaults to the first page of 50", async () => {
    const { get, search } = setup({ role: "staff", staffRoles: ["read_only"] });

    await get("/log");

    expect(search).toHaveBeenCalledWith({ limit: 50, offset: 0, includePii: false });
  });

  it.each([
    ["an unknown view", "view=everything"],
    ["a malformed date", "from=24-10-2026"],
    ["a reversed range", "from=2026-10-24&to=2026-10-01"],
    ["a wildcard event type", "eventTypes=lot.%25"],
    ["a page that is too large", "limit=500"],
  ])("rejects %s", async (_label, query) => {
    const { get, search } = setup({ role: "staff", staffRoles: ["administrator"] });

    expect((await get(`/log?${query}`)).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("serves unredacted fields only to roles that may read PII, and only when asked", async () => {
    const viewer = setup({ role: "staff", staffRoles: ["read_only"] });
    await viewer.get("/log?includePii=1");
    expect(viewer.search).toHaveBeenCalledWith(expect.objectContaining({ includePii: false }));

    const admin = setup({ role: "staff", staffRoles: ["administrator"] });
    await admin.get("/log");
    expect(admin.search).toHaveBeenLastCalledWith(expect.objectContaining({ includePii: false }));
    await admin.get("/log?includePii=1");
    expect(admin.search).toHaveBeenLastCalledWith(expect.objectContaining({ includePii: true }));
  });

  it("searches actors by text with a bounded page", async () => {
    const { get, searchActors } = setup({ role: "staff", staffRoles: ["administrator"] });

    await get("/actors?q=ada&limit=10");

    expect(searchActors).toHaveBeenCalledWith({ q: "ada", limit: 10, includePii: false });
    expect((await get("/actors?limit=51")).status).toBe(400);
  });

  it("keeps the existing domain-events feed behind the same access", async () => {
    const { get, listRedacted } = setup({ role: "client", staffRoles: [] });

    expect((await get("/domain-events")).status).toBe(403);
    expect(listRedacted).not.toHaveBeenCalled();
  });
});
