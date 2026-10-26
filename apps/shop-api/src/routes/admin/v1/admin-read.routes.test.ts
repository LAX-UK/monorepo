import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { type ShopStaffRole, capabilitiesForRole, clientListScope } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const PARTY_ID = "22222222-2222-4222-8222-222222222222";
const ARTIST_ID = "33333333-3333-4333-8333-333333333333";

function mockAdminAuth(subject: string, role: import("@auction/shop-domain").ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  return createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (s) =>
        s === subject ? { role, identitySubjectId: s } : null,
      brokerCanAccessClientParty: async (_broker, clientPartyId) => clientPartyId === PARTY_ID,
    },
  });
}

describe("admin read routes", () => {
  describe("overview KPIs", () => {
    async function readKpis(role: import("@auction/shop-domain").ShopStaffRole) {
      const deps = mockAdminAuth(`${role}-subject`, role);
      const readOverviewKpis = vi.fn(async (keys: readonly string[]) =>
        Object.fromEntries(keys.map((key) => [key, 7])),
      );
      deps.admin.adminRead.overview.readOverviewKpis = readOverviewKpis;
      const app = createShopApiApp({ deps, logger: false });
      await app.ready();
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/overview/kpis",
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      await app.close();
      return { response, readOverviewKpis };
    }

    it.each([
      ["finance", ["payoutsDueCount"]],
      ["operations", ["fulfilmentOpenCount"]],
      ["broker", ["activeHoldsCount"]],
      ["catalogue_editor", []],
      [
        "shop_admin",
        [
          "fulfilmentOpenCount",
          "payoutsDueCount",
          "activeHoldsCount",
          "pendingAuthorityRequestsCount",
        ],
      ],
    ] as const)("%s staff are sent, and the database is asked for, only %j", async (role, keys) => {
      const { response, readOverviewKpis } = await readKpis(role);
      expect(response.statusCode).toBe(200);
      expect(Object.keys(response.json()).sort()).toEqual([...keys].sort());
      expect([...(readOverviewKpis.mock.calls[0]?.[0] ?? [])].sort()).toEqual([...keys].sort());
    });
  });

  it("returns order detail for audit staff", async () => {
    const deps = mockAdminAuth("finance-subject", "finance");
    deps.admin.adminRead.orders.getOrderDetail = async () => ({
      orderId: ORDER_ID,
      status: "paid",
      fulfilment: "uk_insured_delivery",
      totalPence: 1000,
      buyerSubjectId: "buyer",
      buyerName: "Ada Lovelace",
      buyerEmail: "ada@example.com",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      paidAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      lines: [],
      fulfilmentRecord: null,
      refunds: [],
      activity: [],
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/orders/${ORDER_ID}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().orderId).toBe(ORDER_ID);
    await app.close();
  });

  it("returns client detail for account managers", async () => {
    const deps = mockAdminAuth("am-subject", "account_manager");
    deps.admin.adminRead.parties.getClientDetail = async () => ({
      party: {
        partyId: PARTY_ID,
        displayName: "Client",
        kind: "person",
        identitySubjectId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      editions: [],
      saleAuthority: [],
      requests: [],
      payouts: [],
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/clients/${PARTY_ID}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().party.partyId).toBe(PARTY_ID);
    await app.close();
  });

  it("forbids broker client detail when not assigned", async () => {
    const deps = mockAdminAuth("broker-subject", "broker");
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/clients/99999999-9999-4999-8999-999999999999",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("returns artist detail for catalogue editors", async () => {
    const deps = mockAdminAuth("cat-subject", "catalogue_editor");
    deps.admin.adminRead.parties.getArtistDetail = async () => ({
      artist: {
        artistId: ARTIST_ID,
        slug: "artist",
        displayName: "Artist",
        discipline: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      artworks: [],
      editions: [],
      sales: [],
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/artists/${ARTIST_ID}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().artist.artistId).toBe(ARTIST_ID);
    await app.close();
  });
});

describe("GET /admin/v1/clients follows the client list scope the nav uses", () => {
  const ROLES: ShopStaffRole[] = [
    "shop_admin",
    "account_manager",
    "broker",
    "operations",
    "finance",
    "catalogue_editor",
  ];

  async function listClients(role: ShopStaffRole) {
    const deps = mockAdminAuth(`${role}-subject`, role);
    const listClientParties = vi.fn(async () => ({ items: [], nextCursor: null, counts: {} }));
    deps.admin.adminRead.parties.listClientParties = listClientParties;
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    await app.close();
    return { response, listClientParties };
  }

  it.each(ROLES)("%s: the route answers as clientListScope says", async (role) => {
    const { response } = await listClients(role);
    const scope = clientListScope(capabilitiesForRole(role));
    expect(response.statusCode === 200).toBe(scope !== "none");
  });

  it("gives a broker only the clients assigned to them", async () => {
    const { response, listClientParties } = await listClients("broker");
    expect(response.statusCode).toBe(200);
    expect(listClientParties).toHaveBeenCalledWith(
      expect.objectContaining({ brokerSubjectId: "broker-subject" }),
    );
  });

  it("gives full-access roles the whole list", async () => {
    const { listClientParties } = await listClients("account_manager");
    expect(listClientParties).toHaveBeenCalledWith({});
  });
});
