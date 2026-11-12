import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps, createTestZohoSyncHealth } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
];
/** Reading the From Zoho queue; `artwork_register.review` includes it. */
const CAN_READ: ShopStaffRole[] = ["shop_admin", "catalogue_editor", "read_only"];

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.zohoSyncHealth = createTestZohoSyncHealth({
    drift: {
      counts: async () => ({
        registerWithoutProduct: 1,
        productsWithoutRegister: 0,
        statusMismatches: 0,
      }),
      registerWithoutProduct: async () => ({
        rows: [
          {
            registerId: "44444444-4444-4444-8444-444444444444",
            stockCode: "LAX-ORI-PH-GAC-26-0001",
            title: "Harbour at dusk",
            artistName: "A. Painter",
            offerState: "held" as const,
            foundAt: new Date("2026-11-03T02:30:00.000Z"),
          },
        ],
        total: 1,
      }),
      productsWithoutRegister: async () => ({ rows: [], total: 0 }),
      statusMismatches: async () => ({ rows: [], total: 0 }),
    },
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const URLS = [
  "/admin/v1/artwork-register/sync-health",
  "/admin/v1/artwork-register/sync-health/register-without-product",
  "/admin/v1/artwork-register/sync-health/product-without-register",
  "/admin/v1/artwork-register/sync-health/status-mismatch",
];

describe("Sync health capabilities", () => {
  for (const role of ALL_ROLES) {
    const allowed = CAN_READ.includes(role);
    it(`${role} ${allowed ? "can" : "cannot"} read every Sync health list`, async () => {
      const app = await buildApp(role);
      for (const url of URLS) {
        const response = await app.inject({ method: "GET", url, headers: auth });
        expect(response.statusCode, `${role} ${url}`).toBe(allowed ? 200 : 403);
      }
      await app.close();
    });
  }

  it("needs a signed-in staff member", async () => {
    const app = await buildApp("shop_admin");
    for (const url of URLS) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(401);
    }
    await app.close();
  });
});

describe("Sync health responses", () => {
  it("answers the summary with Zoho off when the worker has not reported", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({ method: "GET", url: URLS[0] as string, headers: auth });
    expect(response.json()).toMatchObject({
      zohoOff: true,
      modes: null,
      token: { status: "unknown" },
      drift: { registerWithoutProduct: 1 },
    });
    await app.close();
  });

  it("pages a drift list", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `${URLS[1]}?page=1`,
      headers: auth,
    });
    expect(response.json()).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 25,
      items: [{ stockCode: "LAX-ORI-PH-GAC-26-0001", place: "Not offered" }],
    });
    await app.close();
  });

  it("refuses a page that is not a positive number", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `${URLS[1]}?page=0`,
      headers: auth,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
