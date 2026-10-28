import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "88888888-8888-4888-8888-888888888888",
};
const ARTWORK = "11111111-1111-4111-8111-111111111111";
const FACTS = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
};

type EditionRuns = AdminRoutesDeps["editionRuns"];

async function buildApp(
  role: ShopStaffRole,
  overrides: { [K in keyof EditionRuns]?: Partial<EditionRuns[K]> } = {},
) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const runs = base.admin.editionRuns;
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({ role, identitySubjectId: subject }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        editionRuns: {
          runs: { ...runs.runs, ...overrides.runs },
          facts: { ...runs.facts, ...overrides.facts },
          stock: { ...runs.stock, ...overrides.stock },
          listings: { ...runs.listings, ...overrides.listings },
        },
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("admin edition run routes", () => {
  it("saves facts for catalogue editors, with the actor and the key", async () => {
    const save = vi.fn(async () => ({ factsVersion: "2026-10-01T10:00:00.000Z", confirmed: true }));
    const app = await buildApp("catalogue_editor", { facts: { save } });
    const response = await app.inject({
      method: "PUT",
      url: `/admin/v1/artworks/${ARTWORK}/edition-facts`,
      headers,
      payload: { facts: FACTS, confirmed: true, expectedFactsVersion: null },
    });
    expect(response.statusCode).toBe(200);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        artworkId: ARTWORK,
        confirmed: true,
        actorSubjectId: "catalogue_editor-subject",
        idempotencyKey: headers["idempotency-key"],
      }),
    );
    await app.close();
  });

  it("keeps correcting sold facts to shop admins", async () => {
    const payload = { facts: FACTS, reason: "Wrong signature", expectedFactsVersion: null };
    const editor = await buildApp("catalogue_editor");
    const refused = await editor.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/edition-facts/correct`,
      headers,
      payload,
    });
    expect(refused.statusCode).toBe(403);
    await editor.close();
    const admin = await buildApp("shop_admin");
    const allowed = await admin.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/edition-facts/correct`,
      headers,
      payload,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().affectedOrders).toBe(0);
    await admin.close();
  });

  it("refuses edition run writes to staff without catalogue access", async () => {
    const app = await buildApp("finance");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/stock-batches`,
      headers,
      payload: { artistCount: 5, laxCount: 5, custody: "unprinted" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("passes the shop admin's hors commerce approval and price access to the listing", async () => {
    const createProofListing = vi.fn(async () => ({
      artworkId: ARTWORK,
      slug: "harbour-hors-commerce-proof",
      version: "2026-10-01T10:00:00.000Z",
    }));
    const editor = await buildApp("catalogue_editor", { listings: { createProofListing } });
    await editor.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/proof-listings`,
      headers,
      payload: { proofType: "hc", count: 1, owner: "lax", horsCommerceApproved: true },
    });
    expect(createProofListing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canApproveHorsCommerce: false,
        canSetPrice: false,
        horsCommerceApproved: true,
      }),
    );
    await editor.close();
    const admin = await buildApp("shop_admin", { listings: { createProofListing } });
    await admin.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/proof-listings`,
      headers,
      payload: { proofType: "hc", count: 1, owner: "lax", horsCommerceApproved: true },
    });
    expect(createProofListing).toHaveBeenLastCalledWith(
      expect.objectContaining({ canApproveHorsCommerce: true, canSetPrice: true }),
    );
    await admin.close();
  });

  it("needs an idempotency key and refuses a malformed run", async () => {
    const app = await buildApp("shop_admin");
    const noKey = await app.inject({
      method: "PUT",
      url: `/admin/v1/artworks/${ARTWORK}/run`,
      headers: { authorization: headers.authorization },
      payload: {
        spec: { type: "lax_standard" },
        proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
        expectedVersion: "2026-10-01T10:00:00.000Z",
      },
    });
    expect(noKey.statusCode).toBe(400);
    const malformed = await app.inject({
      method: "PUT",
      url: `/admin/v1/artworks/${ARTWORK}/run`,
      headers,
      payload: { spec: { type: "triple" }, expectedVersion: "2026-10-01T10:00:00.000Z" },
    });
    expect(malformed.statusCode).toBe(400);
    await app.close();
  });
});
