import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import type { AdminOrderListInput } from "../../../application/ports/admin-readers.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const auth = { authorization: "Bearer admin-token-placeholder-minimum-length" };

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];
const CAN_READ: ShopStaffRole[] = ["shop_admin", "account_manager", "operations", "finance"];

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const listOrders = vi.fn(async (_input: AdminOrderListInput) => ({
    items: [],
    nextCursor: null,
    counts: { paid: 3, pending_payment: 1 },
  }));
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject) => ({ role, identitySubjectId: subject }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.adminRead.orders.listOrders = listOrders;
  const ukToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(),
  );
  const readOrderDailyTotals = vi.fn(async (_since: Date) => ({
    paid: new Map([[ukToday, { pence: 18500, orders: 1 }]]),
    placed: new Map([[ukToday, 2]]),
  }));
  deps.admin.adminRead.orders.readOrderDailyTotals = readOrderDailyTotals;
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, listOrders, readOrderDailyTotals };
}

const get = (url: string) => ({ method: "GET" as const, url, headers: auth });

describe("order list capability", () => {
  it.each(ALL_ROLES.map((role) => ({ role, allowed: CAN_READ.includes(role) })))(
    "$role is allowed: $allowed",
    async ({ role, allowed }) => {
      const { app, listOrders } = await buildApp(role);
      const response = await app.inject(get("/admin/v1/orders?status=paid"));
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      expect(listOrders).toHaveBeenCalledTimes(allowed ? 1 : 0);
      await app.close();
    },
  );
});

describe("order list filters", () => {
  it("passes every filter through and returns the per-status counts", async () => {
    const { app, listOrders } = await buildApp("finance");
    const response = await app.inject(
      get(
        "/admin/v1/orders?status=paid&createdFrom=2026-03-01&createdTo=2026-03-31&q=%20ada%20&limit=20",
      ),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().counts).toEqual({ paid: 3, pending_payment: 1 });
    expect(listOrders).toHaveBeenCalledWith({
      status: "paid",
      createdFrom: "2026-03-01",
      createdTo: "2026-03-31",
      q: "ada",
      limit: 20,
    });
    await app.close();
  });

  it("sends the search text on untouched, leaving LIKE escaping to the repository", async () => {
    const { app, listOrders } = await buildApp("finance");
    await app.inject(get(`/admin/v1/orders?q=${encodeURIComponent("50%_\\")}`));
    expect(listOrders.mock.calls[0]?.[0].q).toBe("50%_\\");
    await app.close();
  });

  it("drops a blank search and omits filters that were not asked for", async () => {
    const { app, listOrders } = await buildApp("finance");
    await app.inject(get("/admin/v1/orders?q=%20%20"));
    expect(listOrders).toHaveBeenCalledWith({});
    await app.close();
  });

  it("accepts a single-sided date range", async () => {
    const { app, listOrders } = await buildApp("finance");
    await app.inject(get("/admin/v1/orders?createdFrom=2026-03-01"));
    expect(listOrders).toHaveBeenCalledWith({ createdFrom: "2026-03-01" });
    await app.close();
  });

  it.each([
    ["an unknown status", "status=shipped"],
    ["a status in the wrong case", "status=PAID"],
    ["a date that is not ISO", "createdFrom=01/03/2026"],
    ["a day that does not exist", "createdTo=2026-02-30"],
    ["a range that ends before it starts", "createdFrom=2026-03-31&createdTo=2026-03-01"],
    ["a search over the length limit", `q=${"a".repeat(101)}`],
    ["a limit over the maximum", "limit=101"],
  ])("rejects %s", async (_name, query) => {
    const { app, listOrders } = await buildApp("finance");
    const response = await app.inject(get(`/admin/v1/orders?${query}`));
    expect(response.statusCode).toBe(400);
    expect(listOrders).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("order summary", () => {
  it.each(ALL_ROLES.map((role) => ({ role, allowed: CAN_READ.includes(role) })))(
    "$role is allowed: $allowed",
    async ({ role, allowed }) => {
      const { app } = await buildApp(role);
      const response = await app.inject(get("/admin/v1/orders/summary"));
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      await app.close();
    },
  );

  it("returns 30 UK days of paid totals and orders, with the 30 days before", async () => {
    const { app, readOrderDailyTotals } = await buildApp("finance");
    const response = await app.inject(get("/admin/v1/orders/summary"));
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.periodDays).toBe(30);
    expect(body.paidPence.daily).toHaveLength(30);
    expect(body.paidPence.daily.at(-1)).toBe(18500);
    expect(body.paidPence.current).toBe(18500);
    expect(body.orders).toMatchObject({ current: 2, prior: 0 });
    expect(body.paidOrders).toEqual({ current: 1, prior: 0 });
    expect(readOrderDailyTotals).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
