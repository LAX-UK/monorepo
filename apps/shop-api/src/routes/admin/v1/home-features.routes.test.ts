import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createInMemoryHomeFeatures } from "../../../test-support/in-memory-home-features.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};
const artistId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ORIGINAL = "11111111-1111-4111-8111-111111111111";

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const store = createInMemoryHomeFeatures();
  store.add(
    ...Array.from({ length: 9 }, (_, index) => ({ kind: "artist" as const, id: artistId(index) })),
    { kind: "artwork", id: ORIGINAL, isShopEdition: false },
  );
  const invalidateCatalogue = vi.fn(async () => {});
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({ role, identitySubjectId: subject }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        homeFeatures: store.service,
        artCache: { invalidateEditorial: async () => {}, invalidateCatalogue },
      },
    }),
    logger: false,
  });
  await app.ready();
  return { app, store, invalidateCatalogue };
}

function save(app: Awaited<ReturnType<typeof buildApp>>["app"], slot: string, ids: string[]) {
  return app.inject({
    method: "PUT",
    url: `/admin/v1/home-features/${slot}`,
    headers,
    payload: { ids },
  });
}

describe("admin home feature routes", () => {
  it("lets catalogue editors save the artists, audited, and refreshes lax.art", async () => {
    const { app, store, invalidateCatalogue } = await buildApp("catalogue_editor");
    const response = await save(app, "featured_artists", [artistId(1), artistId(0)]);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      featured_prints: [],
      featured_artists: [],
      featured_categories: [],
    });
    expect(store.saved.featured_artists).toEqual([artistId(1), artistId(0)]);
    expect(store.audit).toEqual([
      expect.objectContaining({
        actorSubjectId: "catalogue_editor-subject",
        capability: "editorial.publish",
        action: "home_features.replace",
        targetId: "featured_artists",
        beforeJson: { ids: [] },
        afterJson: { ids: [artistId(1), artistId(0)] },
      }),
    ]);
    expect(invalidateCatalogue).toHaveBeenCalledWith("artists");
    await app.close();
  });

  it("refuses staff without editorial.publish, but lets them read", async () => {
    const { app, store } = await buildApp("operations");
    const refused = await save(app, "featured_artists", [artistId(0)]);
    expect(refused.statusCode).toBe(403);
    expect(store.writes).toEqual([]);
    const read = await app.inject({ method: "GET", url: "/admin/v1/home-features", headers });
    expect(read.statusCode).toBe(200);
    const search = await app.inject({
      method: "GET",
      url: "/admin/v1/home-features/featured_artists/candidates?q=flora",
      headers,
    });
    expect(search.statusCode).toBe(403);
    await app.close();
  });

  it("refuses a ninth artist and names the row", async () => {
    const { app, store } = await buildApp("shop_admin");
    const response = await save(
      app,
      "featured_artists",
      Array.from({ length: 9 }, (_, index) => artistId(index)),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [{ index: 8, targetId: artistId(8), reason: "over_limit" }],
    });
    expect(store.writes).toEqual([]);
    await app.close();
  });

  it("refuses duplicates and an original among the prints", async () => {
    const { app } = await buildApp("shop_admin");
    const twice = await save(app, "featured_artists", [artistId(0), artistId(0)]);
    expect(twice.json()).toMatchObject({ issues: [{ index: 1, reason: "duplicate" }] });
    const original = await save(app, "featured_prints", [ORIGINAL]);
    expect(original.statusCode).toBe(400);
    expect(original.json()).toMatchObject({
      issues: [{ index: 0, reason: "not_a_shop_edition" }],
    });
    await app.close();
  });

  it("refuses an unknown slot, ids that are not uuids and a missing key", async () => {
    const { app } = await buildApp("shop_admin");
    expect((await save(app, "featured_originals", [])).statusCode).toBe(400);
    expect((await save(app, "featured_artists", ["not-a-uuid"])).statusCode).toBe(400);
    const keyless = await app.inject({
      method: "PUT",
      url: "/admin/v1/home-features/featured_artists",
      headers: { authorization: headers.authorization },
      payload: { ids: [] },
    });
    expect(keyless.statusCode).toBe(400);
    await app.close();
  });

  it("lets editors search a slot's candidates", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/home-features/featured_prints/candidates?q=vessel",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
    await app.close();
  });
});
