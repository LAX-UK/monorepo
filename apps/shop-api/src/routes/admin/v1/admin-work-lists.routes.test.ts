import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

/*
 * The sales and operations work lists take a status, a search, a sort and a cursor, and answer
 * with their per-status counts. The route passes the query through as validated; the
 * repository owns the filtering.
 */

type Deps = ReturnType<typeof createMinimalShopApiTestDeps>;

async function call(role: ShopStaffRole, url: string, wire: (deps: Deps) => unknown) {
  const subject = `${role}-subject`;
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
      SHOP_THIRD_PARTY_ENABLED: true,
      SHOP_ORIGINALS_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (s) =>
        s === subject ? { roles: [role], identitySubjectId: s } : null,
      brokerCanAccessClientParty: async () => false,
    },
  });
  const spy = wire(deps);
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  const response = await app.inject({
    method: "GET",
    url,
    headers: { authorization: "Bearer admin-token-placeholder-minimum-length" },
  });
  await app.close();
  return { response, spy, subject };
}

const page = { items: [], nextCursor: null, counts: { due: 2, paid: 5 } };

const LISTS = [
  {
    name: "fulfilment",
    role: "operations",
    url: "/admin/v1/fulfilment?stage=open&status=in_transit&option=lax_storage&q=AB12&sort=updated_asc&limit=50",
    expected: {
      stage: "open",
      status: "in_transit",
      option: "lax_storage",
      q: "AB12",
      sort: "updated_asc",
      limit: 50,
    },
    bad: ["status=shipped", "stage=later", "sort=created_desc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.fulfilment.listFulfilment = spy;
      return spy;
    },
  },
  {
    name: "payouts",
    role: "finance",
    url: "/admin/v1/payouts?status=due&source=original_sale&q=Ada&sort=due_desc",
    expected: { status: "due", source: "original_sale", q: "Ada", sort: "due_desc" },
    bad: ["status=pending", "source=bank", "sort=amount_desc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.payouts.listPayouts = spy;
      return spy;
    },
  },
  {
    name: "stock holds",
    role: "shop_admin",
    url: "/admin/v1/stock-holds?status=active&q=Vessel&sort=expires_asc",
    expected: { status: "active", q: "Vessel", sort: "expires_asc" },
    bad: ["status=held", "sort=due_asc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.sales.listStockHolds = spy;
      return spy;
    },
  },
  {
    name: "third-party sales",
    role: "finance",
    url: "/admin/v1/third-party-sales?status=recorded&fee=pending&q=Vessel&sort=created_asc",
    expected: { status: "recorded", fee: "pending", q: "Vessel", sort: "created_asc" },
    bad: ["status=sold", "fee=approved", "sort=expires_asc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.sales.listThirdPartySales = spy;
      return spy;
    },
  },
  {
    name: "original sales",
    role: "shop_admin",
    url: "/admin/v1/original-sales?status=invoiced&q=ada%40example.com&sort=created_asc",
    expected: { status: "invoiced", q: "ada@example.com", sort: "created_asc" },
    bad: ["status=sold", "sort=due_desc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.sales.listOriginalSales = spy;
      return spy;
    },
  },
  {
    name: "sale limit requests",
    role: "shop_admin",
    url: "/admin/v1/sale-authority-requests?status=rejected&q=Ada&sort=created_asc",
    expected: { status: "rejected", q: "Ada", sort: "created_asc" },
    bad: ["status=declined", "sort=opened_desc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.saleAuthorityRequests.listRequests = spy;
      return spy;
    },
  },
  {
    name: "disputes",
    role: "shop_admin",
    url: "/admin/v1/disputes?status=opened&q=1a2b&sort=opened_asc",
    expected: { status: "opened", q: "1a2b", sort: "opened_asc" },
    bad: ["status=pending", "sort=created_desc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => page);
      deps.admin.adminRead.compliance.listDisputes = spy;
      return spy;
    },
  },
] as const;

describe.each(LISTS)("the $name list", (list) => {
  it("passes its filters, search and sort through and returns the counts", async () => {
    const { response, spy } = await call(list.role, list.url, list.wire);
    expect(response.statusCode).toBe(200);
    expect(response.json().counts).toEqual({ due: 2, paid: 5 });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining(list.expected));
  });

  it.each([...list.bad, `q=${"a".repeat(101)}`, "limit=101"])("rejects %s", async (query) => {
    const path = list.url.split("?")[0];
    const { response, spy } = await call(list.role, `${path}?${query}`, list.wire);
    expect(response.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("the stock holds list for a broker", () => {
  it("keeps to the broker's own clients whatever else is asked", async () => {
    const { spy, subject } = await call("broker", "/admin/v1/stock-holds?status=active", (deps) => {
      const fn = vi.fn(async () => page);
      deps.admin.adminRead.sales.listStockHolds = fn;
      return fn;
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", brokerSubjectId: subject }),
    );
  });
});
