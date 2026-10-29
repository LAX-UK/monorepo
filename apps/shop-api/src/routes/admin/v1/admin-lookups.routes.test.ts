import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const TOKEN = "admin-token-placeholder-minimum-length";
const PARTY_ID = "22222222-2222-4222-8222-222222222222";

function depsFor(role: ShopStaffRole) {
  const subject = `${role}-subject`;
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  return {
    subject,
    deps: createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_THIRD_PARTY_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) =>
          s === subject ? { roles: [role], identitySubjectId: s } : null,
        brokerCanAccessClientParty: async () => false,
      },
    }),
  };
}

async function get(
  role: ShopStaffRole,
  url: string,
  tweak?: (deps: ReturnType<typeof depsFor>["deps"]) => void,
) {
  const { deps, subject } = depsFor(role);
  tweak?.(deps);
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  const response = await app.inject({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  await app.close();
  return { response, subject };
}

describe("staff picker lookups", () => {
  it.each([
    ["account_manager", 200],
    ["broker", 200],
    ["operations", 200],
    ["shop_admin", 200],
    ["finance", 403],
    ["catalogue_editor", 403],
  ] as const)("people search for %s answers %i", async (role, status) => {
    const { response } = await get(role, "/admin/v1/lookups/parties?q=ada");
    expect(response.statusCode).toBe(status);
  });

  it("limits a broker's people search to their assigned clients", async () => {
    const searchParties = vi.fn(async () => [
      { partyId: PARTY_ID, displayName: "Ada Lovelace", kind: "person", email: "ada@example.com" },
    ]);
    const { response, subject } = await get("broker", "/admin/v1/lookups/parties?q=ada", (deps) => {
      deps.admin.adminRead.lookups.searchParties = searchParties;
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].email).toBe("ada@example.com");
    expect(searchParties).toHaveBeenCalledWith({ q: "ada", limit: 15, brokerSubjectId: subject });
  });

  it("searches every person for roles that can see all clients", async () => {
    const searchParties = vi.fn(async () => []);
    await get("account_manager", "/admin/v1/lookups/parties?limit=5", (deps) => {
      deps.admin.adminRead.lookups.searchParties = searchParties;
    });
    expect(searchParties).toHaveBeenCalledWith({ q: undefined, limit: 5 });
  });

  it("rejects a search longer than the limit", async () => {
    const { response } = await get(
      "account_manager",
      `/admin/v1/lookups/parties?q=${"a".repeat(101)}`,
    );
    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["account_manager", "artworks", 200],
    ["catalogue_editor", "artworks", 200],
    ["broker", "artworks", 403],
    ["operations", "artworks", 403],
    ["broker", "editions", 200],
    ["operations", "editions", 200],
    ["account_manager", "editions", 200],
    ["catalogue_editor", "editions", 403],
    ["finance", "editions", 403],
  ] as const)("%s searching %s answers %i", async (role, kind, status) => {
    const { response } = await get(role, `/admin/v1/lookups/${kind}?q=vessel`);
    expect(response.statusCode).toBe(status);
  });

  it("returns editions with the artwork and artist that identify them", async () => {
    const { response } = await get("operations", "/admin/v1/lookups/editions?q=vessel", (deps) => {
      deps.admin.adminRead.lookups.searchEditions = async () => [
        {
          editionId: "44444444-4444-4444-8444-444444444444",
          artworkId: "55555555-5555-4555-8555-555555555555",
          artworkTitle: "Vessel Study",
          artistName: "Theo Marsh",
          editionNumber: 2,
          listingStatus: "available",
        },
      ];
    });
    expect(response.json().items[0]).toMatchObject({
      artworkTitle: "Vessel Study",
      editionNumber: 2,
    });
  });
});

describe("GET /admin/v1/third-party-sales", () => {
  it.each([
    ["operations", 200],
    ["finance", 200],
    ["shop_admin", 200],
    ["broker", 403],
    ["account_manager", 403],
  ] as const)("answers %s with %i", async (role, status) => {
    const { response } = await get(role, "/admin/v1/third-party-sales");
    expect(response.statusCode).toBe(status);
  });

  it("includes each sale's fees so finance can approve them from the list", async () => {
    const { response } = await get("finance", "/admin/v1/third-party-sales", (deps) => {
      deps.admin.adminRead.sales.listThirdPartySales = async () => ({
        items: [
          {
            saleId: "66666666-6666-4666-8666-666666666666",
            editionId: "44444444-4444-4444-8444-444444444444",
            artworkTitle: "Vessel Study",
            editionNumber: 1,
            status: "recorded",
            grossPence: 120000,
            recordedAt: null,
            fees: [
              {
                feeId: "77777777-7777-4777-8777-777777777777",
                label: "Commission",
                amountPence: 12000,
                status: "pending",
              },
            ],
            sellerName: "Ada Seller",
            buyerName: "Ben Buyer",
            createdAt: "2026-10-01T09:00:00.000Z",
          },
        ],
        nextCursor: null,
        counts: { recorded: 1 },
      });
    });
    expect(response.json().items[0].fees[0]).toMatchObject({
      label: "Commission",
      status: "pending",
    });
  });
});
