import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { buyingError } from "../../services/organisation-buying/purchase-view.js";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
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
  const deliveryQuotes = {
    quote: vi.fn(),
    decline: vi
      .fn()
      .mockResolvedValue(
        ok({ id: "quote-1", status: "withdrawn", declineReason: "We don't ship to Lyon" }),
      ),
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
  attachAdminDeliveriesRoutes(
    app as never,
    { admin: { deliveries, deliveryQuotes } } as never,
    createTestStaffGuards(),
  );
  return { app, deliveries, deliveryQuotes };
}

const reads = ["/deliveries", "/deliveries/summary", `/deliveries/${LOT}`];

describe("deliveries access", () => {
  // D5: the page is hidden from roles without LOT_FULFILMENT_ACCESS (PRM-1), so the reads are
  // refused to exactly the roles that cannot open Lot fulfilment, read-only staff included.
  it.each(userStaffRoles)("%s: reads follow Lot fulfilment access", async (role) => {
    const canRead = role === "administrator" || role === "fulfilment";
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

  it("refuses read-only staff, who cannot open Lot fulfilment either", async () => {
    const { app, deliveries } = createApp(["read_only"]);
    for (const path of reads) {
      expect((await app.request(`http://test${path}`)).status, path).toBe(403);
    }
    expect(deliveries.list).not.toHaveBeenCalled();
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
    const { app, deliveries } = createApp(["fulfilment"]);
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

describe("POST /deliveries/:lotId/decline", () => {
  const path = `http://test/deliveries/${LOT}/decline`;
  const post = (body: unknown, key?: string) => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
  const REASON = { reason: "  We don't ship to Lyon  " };

  it.each(userStaffRoles)("%s: only Fulfilment and Administrators may decline", async (role) => {
    const { app, deliveryQuotes } = createApp([role]);
    const res = await app.request(path, post(REASON, `decline-role-${role}`));
    const allowed = role === "administrator" || role === "fulfilment";
    expect(res.status, role).toBe(allowed ? 200 : 403);
    expect(deliveryQuotes.decline).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it("declines with the trimmed reason, as the signed-in staff member, uncached", async () => {
    const { app, deliveryQuotes } = createApp(["fulfilment"]);
    const res = await app.request(path, post(REASON, "decline-key-0001"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      data: { id: "quote-1", status: "withdrawn", declineReason: "We don't ship to Lyon" },
    });
    expect(deliveryQuotes.decline).toHaveBeenCalledWith({
      staffUserId: "staff-1",
      lotId: LOT,
      reason: "We don't ship to Lyon",
    });
  });

  it("needs an Idempotency-Key, and declines once when the same request is sent twice", async () => {
    const { app, deliveryQuotes } = createApp(["fulfilment"]);
    const missing = await app.request(path, post(REASON));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "idempotency_key_required" });
    expect(deliveryQuotes.decline).not.toHaveBeenCalled();

    const first = await app.request(path, post(REASON, "decline-key-0002"));
    const again = await app.request(path, post(REASON, "decline-key-0002"));
    expect(again.status).toBe(200);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await again.json()).toEqual(await first.json());
    expect(deliveryQuotes.decline).toHaveBeenCalledTimes(1);

    const changed = await app.request(path, post({ reason: "Other" }, "decline-key-0002"));
    expect(changed.status).toBe(422);
    expect(deliveryQuotes.decline).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "   " }],
    ["a reason over 500 characters", { reason: "x".repeat(501) }],
    ["an unknown field", { reason: "No", amount: "1.00" }],
  ])("refuses %s before touching the quote", async (_label, body) => {
    const { app, deliveryQuotes } = createApp(["fulfilment"]);
    const res = await app.request(path, post(body, `decline-bad-${_label.replaceAll(" ", "-")}`));
    expect(res.status).toBe(400);
    expect(deliveryQuotes.decline).not.toHaveBeenCalled();
  });

  it("refuses a lot id that is not a uuid", async () => {
    const { app, deliveryQuotes } = createApp(["fulfilment"]);
    const res = await app.request(
      "http://test/deliveries/lot-42/decline",
      post(REASON, "decline-key-0003"),
    );
    expect(res.status).toBe(400);
    expect(deliveryQuotes.decline).not.toHaveBeenCalled();
  });

  it.each([
    ["quote_step_not_allowed", 409],
    ["quote_changed", 409],
    ["purchase_not_found", 404],
  ] as const)("answers %s with its status and the error shape", async (code, status) => {
    const { app, deliveryQuotes } = createApp(["fulfilment"]);
    deliveryQuotes.decline.mockResolvedValue(err(buyingError(code)));
    const res = await app.request(path, post(REASON, `decline-err-${code}`));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code, message: buyingError(code).message });
  });
});
