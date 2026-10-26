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
 * The clients, staff and audit lists take a search, their own filters, a sort and a cursor. The
 * route passes the query through as validated and refuses anything else; the repository owns
 * the filtering.
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
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (s) =>
        s === subject ? { role, identitySubjectId: s } : null,
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

const LISTS = [
  {
    name: "clients",
    role: "shop_admin",
    url: "/admin/v1/clients?kind=gallery&q=Ada&sort=joined_asc&limit=50",
    expected: { kind: "gallery", q: "Ada", sort: "joined_asc", limit: 50 },
    bad: ["kind=artist", "sort=created_desc", `q=${"a".repeat(101)}`, "limit=101"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => ({ items: [], nextCursor: null, counts: { person: 3 } }));
      deps.admin.adminRead.parties.listClientParties = spy;
      return spy;
    },
  },
  {
    name: "staff",
    role: "shop_admin",
    url: "/admin/v1/staff?status=disabled&role=finance,broker&q=sam&sort=added_asc",
    expected: { status: "disabled", role: "finance,broker", q: "sam", sort: "added_asc" },
    bad: ["status=suspended", "role=owner", "role=finance,,broker", "sort=joined_asc"],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => ({ items: [], nextCursor: null, counts: { active: 2 } }));
      deps.admin.adminRead.staff.listStaffMembers = spy;
      return spy;
    },
  },
  {
    name: "audit log",
    role: "finance",
    url: "/admin/v1/audit?actor=sub-1&action=mark_payout_paid&targetType=shop_payout_ledger&from=2026-10-01&to=2026-10-24&sort=at_asc",
    expected: {
      actor: "sub-1",
      action: "mark_payout_paid",
      targetType: "shop_payout_ledger",
      from: "2026-10-01",
      to: "2026-10-24",
      sort: "at_asc",
    },
    bad: ["from=01/10/2026", "sort=created_desc", `actor=${"a".repeat(201)}`],
    wire: (deps: Deps) => {
      const spy = vi.fn(async () => ({ items: [], nextCursor: null }));
      deps.admin.adminRead.compliance.listAuditEntries = spy;
      return spy;
    },
  },
] as const;

describe.each(LISTS)("the $name list", (list) => {
  it("passes its filters, search and sort through", async () => {
    const { response, spy } = await call(list.role, list.url, list.wire);
    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining(list.expected));
  });

  it.each(list.bad)("rejects %s", async (query) => {
    const path = list.url.split("?")[0];
    const { response, spy } = await call(list.role, `${path}?${query}`, list.wire);
    expect(response.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("the name sorts", () => {
  it.each([
    ["clients", "/admin/v1/clients?sort=name_asc", "name_asc"],
    ["clients", "/admin/v1/clients?sort=name_desc", "name_desc"],
    ["staff", "/admin/v1/staff?sort=name_asc", "name_asc"],
    ["staff", "/admin/v1/staff?sort=name_desc", "name_desc"],
  ] as const)("the %s list takes %s", async (name, url, sort) => {
    const { response, spy } = await call("shop_admin", url, (deps) => {
      const fn = vi.fn(async () => ({ items: [], nextCursor: null, counts: {} }));
      if (name === "clients") deps.admin.adminRead.parties.listClientParties = fn;
      else deps.admin.adminRead.staff.listStaffMembers = fn;
      return fn;
    });
    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sort }));
  });

  it("refuses a name sort the audit log does not have", async () => {
    const { response } = await call("finance", "/admin/v1/audit?sort=name_asc", () => undefined);
    expect(response.statusCode).toBe(400);
  });
});

describe("the clients list for a broker", () => {
  it("keeps to the broker's own clients whatever else is asked", async () => {
    const { spy, subject } = await call("broker", "/admin/v1/clients?kind=person", (deps) => {
      const fn = vi.fn(async () => ({ items: [], nextCursor: null, counts: {} }));
      deps.admin.adminRead.parties.listClientParties = fn;
      return fn;
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "person", brokerSubjectId: subject }),
    );
  });
});

describe("the audit filters", () => {
  it("offer the event codes, record kinds and people in the log to roles that read it", async () => {
    const facets = {
      actions: ["mark_payout_paid"],
      targetTypes: ["shop_payout_ledger"],
      actors: [{ subjectId: "sub-1", name: "Sam Lee", email: "sam@lax.art" }],
    };
    const { response } = await call("finance", "/admin/v1/audit/facets", (deps) => {
      deps.admin.adminRead.compliance.readAuditFacets = vi.fn(async () => facets);
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(facets);
  });

  it("are closed to roles without the audit log", async () => {
    const { response } = await call("broker", "/admin/v1/audit/facets", () => undefined);
    expect(response.statusCode).toBe(403);
  });
});
