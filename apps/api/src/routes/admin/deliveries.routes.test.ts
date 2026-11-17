import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminDeliveriesRoutes } from "./deliveries.routes.js";

const LOT = "d0000000-0000-4000-8000-0000000000c1";
const SALE = "d0000000-0000-4000-8000-0000000000aa";

function createApp(staffRoles: StaffRoles | undefined) {
  const deliveries = {
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50, counts: {}, sales: [] }),
    summary: vi.fn().mockResolvedValue({ waitingCount: 3 }),
    detail: vi.fn().mockResolvedValue({ lotId: LOT, status: "waiting" }),
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
  attachAdminDeliveriesRoutes(app as never, { admin: { deliveries } } as never);
  return { app, deliveries };
}

const reads = ["/deliveries", "/deliveries/summary", `/deliveries/${LOT}`];

describe("deliveries access", () => {
  it.each(userStaffRoles)("%s: reads follow the Deliveries permission", async (role) => {
    const canRead = role === "administrator" || role === "fulfilment" || role === "read_only";
    for (const path of reads) {
      const { app, deliveries } = createApp([role]);
      const res = await app.request(`http://test${path}`);
      expect(res.status === 403, `${role} GET ${path}`).toBe(!canRead);
      if (!canRead) {
        expect(deliveries.list).not.toHaveBeenCalled();
        expect(deliveries.summary).not.toHaveBeenCalled();
        expect(deliveries.detail).not.toHaveBeenCalled();
      }
    }
  });

  it("refuses someone with no staff role", async () => {
    const { app } = createApp(undefined);
    expect((await app.request("http://test/deliveries")).status).toBe(403);
  });
});

describe("GET /deliveries", () => {
  it("opens on Waiting for a price, newest first, 50 rows, without caching", async () => {
    const { app, deliveries } = createApp(["fulfilment"]);
    const res = await app.request("http://test/deliveries");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(deliveries.list).toHaveBeenCalledWith({
      view: "waiting",
      sort: "newest",
      limit: 50,
      offset: 0,
    });
  });

  it("passes the view, search, sale, order and page", async () => {
    const { app, deliveries } = createApp(["read_only"]);
    await app.request(
      `http://test/deliveries?view=on_the_way&q=Lyon&saleId=${SALE}&sort=oldest&limit=25&offset=25`,
    );
    expect(deliveries.list).toHaveBeenCalledWith({
      view: "on_the_way",
      q: "Lyon",
      saleId: SALE,
      sort: "oldest",
      limit: 25,
      offset: 25,
    });
  });

  it("rejects a view or sale that does not exist", async () => {
    const { app, deliveries } = createApp(["administrator"]);
    expect((await app.request("http://test/deliveries?view=requested")).status).toBe(400);
    expect((await app.request("http://test/deliveries?saleId=autumn")).status).toBe(400);
    expect(deliveries.list).not.toHaveBeenCalled();
  });
});

describe("GET /deliveries/summary", () => {
  it("answers the number of buyers waiting for a price", async () => {
    const { app } = createApp(["fulfilment"]);
    const res = await app.request("http://test/deliveries/summary");
    expect(await res.json()).toEqual({ data: { waitingCount: 3 } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /deliveries/:lotId", () => {
  it("returns the lot's delivery", async () => {
    const { app, deliveries } = createApp(["fulfilment"]);
    const res = await app.request(`http://test/deliveries/${LOT}`);
    expect(res.status).toBe(200);
    expect(deliveries.detail).toHaveBeenCalledWith(LOT);
  });

  it("answers 404 when nobody asked for a delivery of that lot", async () => {
    const { app, deliveries } = createApp(["fulfilment"]);
    deliveries.detail.mockResolvedValue(null);
    const res = await app.request(`http://test/deliveries/${LOT}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "delivery_not_found" });
  });

  it("rejects a lot id that is not a uuid", async () => {
    const { app } = createApp(["fulfilment"]);
    expect((await app.request("http://test/deliveries/lot-42")).status).toBe(400);
  });
});
