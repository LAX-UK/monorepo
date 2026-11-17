import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
import { attachAdminLotFulfilmentRoutes } from "./lot-fulfilment.routes.js";

const LOT = "d0000000-0000-4000-8000-0000000000c1";

function createApp(staffRoles: StaffRoles = ["fulfilment"]) {
  const deliveryQuotes = {
    quote: vi.fn().mockResolvedValue(ok({ id: "quote-1", status: "quoted", amount: "180.00" })),
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
  attachAdminLotFulfilmentRoutes(
    app as never,
    { admin: { deliveryQuotes, lotFulfilment: {} } } as never,
    createTestStaffGuards(),
  );
  return { app, deliveryQuotes };
}

const put = (body: unknown, key?: string) => ({
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    ...(key ? { "Idempotency-Key": key } : {}),
  },
  body: JSON.stringify(body),
});

const QUOTE = { amount: "180.00", note: "Insured, two-person delivery" };

describe("PUT /lot-fulfilment/:lotId/delivery-quote", () => {
  it("needs an Idempotency-Key", async () => {
    const { app, deliveryQuotes } = createApp();
    const res = await app.request(`http://test/lot-fulfilment/${LOT}/delivery-quote`, put(QUOTE));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "idempotency_key_required" });
    expect(deliveryQuotes.quote).not.toHaveBeenCalled();
  });

  it("prices the quote once when the same request is sent twice", async () => {
    const { app, deliveryQuotes } = createApp();
    const first = await app.request(
      `http://test/lot-fulfilment/${LOT}/delivery-quote`,
      put(QUOTE, "quote-key-0001"),
    );
    const again = await app.request(
      `http://test/lot-fulfilment/${LOT}/delivery-quote`,
      put(QUOTE, "quote-key-0001"),
    );
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await again.json()).toEqual(await first.json());
    expect(deliveryQuotes.quote).toHaveBeenCalledTimes(1);
    expect(deliveryQuotes.quote).toHaveBeenCalledWith({
      staffUserId: "staff-1",
      lotId: LOT,
      amount: "180.00",
      note: "Insured, two-person delivery",
    });
  });

  it("refuses the same key for a different price", async () => {
    const { app, deliveryQuotes } = createApp();
    await app.request(
      `http://test/lot-fulfilment/${LOT}/delivery-quote`,
      put(QUOTE, "quote-key-0002"),
    );
    const changed = await app.request(
      `http://test/lot-fulfilment/${LOT}/delivery-quote`,
      put({ ...QUOTE, amount: "200.00" }, "quote-key-0002"),
    );
    expect(changed.status).toBe(422);
    expect(deliveryQuotes.quote).toHaveBeenCalledTimes(1);
  });

  it("still refuses staff without Fulfilment before reading the key", async () => {
    const { app, deliveryQuotes } = createApp(["read_only"]);
    const res = await app.request(
      `http://test/lot-fulfilment/${LOT}/delivery-quote`,
      put(QUOTE, "quote-key-0003"),
    );
    expect(res.status).toBe(403);
    expect(deliveryQuotes.quote).not.toHaveBeenCalled();
  });
});
