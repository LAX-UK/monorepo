import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import {
  MERCHANDISE_SKU_IN_USE_MESSAGE,
  MERCHANDISE_SLUG_IN_USE_MESSAGE,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import type { MerchandiseCatalogueWriter } from "../../../application/ports/merchandise-catalogue.writer.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { StaleVersionError } from "../../../errors/stale-version-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const IDEMPOTENCY_KEY = "77777777-7777-4777-8777-777777777777";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": IDEMPOTENCY_KEY,
};
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";
const VERSION = "2026-03-01T10:00:00.000Z";

const productDetail = {
  productId: PRODUCT,
  slug: "tote-bag",
  title: "Tote bag",
  description: null,
  status: "active" as const,
  version: VERSION,
  createdAt: VERSION,
  variants: [
    {
      variantId: VARIANT,
      sku: "TOTE-01",
      pricePence: 1500,
      onHand: 4,
      reserved: 1,
      status: "active" as const,
    },
  ],
};

type Overrides = {
  catalogue?: Partial<MerchandiseCatalogueWriter>;
  getProduct?: () => Promise<typeof productDetail | null>;
};

async function buildApp(role: ShopStaffRole, overrides: Overrides = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true, SHOP_MERCHANDISE_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({ role, identitySubjectId: subject }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        adminRead: {
          ...base.admin.adminRead,
          catalogue: {
            listMerchandiseProducts: async () => ({ items: [], nextCursor: null }),
            getMerchandiseProduct: overrides.getProduct ?? (async () => productDetail),
          },
        },
        merchandiseCatalogue: { ...base.admin.merchandiseCatalogue, ...overrides.catalogue },
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const validProduct = {
  slug: "tote-bag",
  title: "Tote bag",
  description: "Canvas.",
  expectedVersion: VERSION,
};

const writes = [
  {
    method: "POST",
    url: "/admin/v1/merchandise/products",
    payload: {
      slug: "tote-bag",
      title: "Tote bag",
      sku: "TOTE-01",
      pricePence: 1500,
      onHand: 3,
    },
  },
  { method: "PUT", url: `/admin/v1/merchandise/products/${PRODUCT}`, payload: validProduct },
  { method: "POST", url: `/admin/v1/merchandise/products/${PRODUCT}/archive` },
  { method: "POST", url: `/admin/v1/merchandise/products/${PRODUCT}/restore` },
  {
    method: "POST",
    url: `/admin/v1/merchandise/products/${PRODUCT}/variants`,
    payload: { sku: "TOTE-02", pricePence: 1800 },
  },
  {
    method: "PUT",
    url: `/admin/v1/merchandise/variants/${VARIANT}`,
    payload: { sku: "TOTE-02", pricePence: 1800 },
  },
  { method: "POST", url: `/admin/v1/merchandise/variants/${VARIANT}/archive` },
  { method: "POST", url: `/admin/v1/merchandise/variants/${VARIANT}/restore` },
  {
    method: "POST",
    url: `/admin/v1/merchandise/variants/${VARIANT}/adjust-stock`,
    payload: { onHand: 5, reason: "Recount" },
  },
] as const;

const reads = [
  { method: "GET", url: "/admin/v1/merchandise/products" },
  { method: "GET", url: `/admin/v1/merchandise/products/${PRODUCT}` },
] as const;

describe("admin merchandise routes", () => {
  describe("capabilities", () => {
    it.each([...reads, ...writes])(
      "forbids staff without merchandise access on $method $url",
      async (route) => {
        const app = await buildApp("operations");
        const response = await app.inject({ ...route, headers });
        expect(response.statusCode).toBe(403);
        await app.close();
      },
    );

    it.each([...reads, ...writes])("rejects an unauthenticated $method $url", async (route) => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({ method: route.method, url: route.url });
      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it.each(writes)("requires an idempotency key on $method $url", async (route) => {
      const app = await buildApp("shop_admin");
      const { "idempotency-key": _omitted, ...withoutKey } = headers;
      const response = await app.inject({ ...route, headers: withoutKey });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("reads", () => {
    it("returns a product with its variants", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(productDetail);
      await app.close();
    });

    it("returns 404 for an unknown product", async () => {
      const app = await buildApp("shop_admin", { getProduct: async () => null });
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it("rejects a status filter outside active and archived", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/merchandise/products?status=deleted",
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("product edits", () => {
    it("passes the trimmed fields, version and actor to the writer", async () => {
      const updateProduct = vi.fn(async () => ({ version: "2026-03-01T10:05:00.000Z" }));
      const app = await buildApp("shop_admin", { catalogue: { updateProduct } });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
        payload: { ...validProduct, title: "  Tote bag  ", description: "   " },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ version: "2026-03-01T10:05:00.000Z" });
      expect(updateProduct).toHaveBeenCalledWith({
        productId: PRODUCT,
        slug: "tote-bag",
        title: "Tote bag",
        description: null,
        expectedVersion: VERSION,
        actorSubjectId: "shop_admin-subject",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      await app.close();
    });

    it("answers a stale save with 409 and the current version", async () => {
      const updateProduct = vi.fn(async () => {
        throw new StaleVersionError("This product", "2026-03-01T10:09:00.000Z");
      });
      const app = await buildApp("shop_admin", { catalogue: { updateProduct } });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
        payload: validProduct,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        currentVersion: "2026-03-01T10:09:00.000Z",
      });
      await app.close();
    });

    it("answers a taken slug with 409 and no version", async () => {
      const updateProduct = vi.fn(async () => {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, MERCHANDISE_SLUG_IN_USE_MESSAGE, 409);
      });
      const app = await buildApp("shop_admin", { catalogue: { updateProduct } });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
        payload: validProduct,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(MERCHANDISE_SLUG_IN_USE_MESSAGE);
      expect(response.json()).not.toHaveProperty("currentVersion");
      await app.close();
    });

    it.each([
      ["a slug with capitals", { slug: "Tote Bag" }],
      ["an empty title", { title: "" }],
      ["a missing version", { expectedVersion: undefined }],
      ["a version that is not a timestamp", { expectedVersion: "yesterday" }],
      ["an over-long title", { title: "x".repeat(201) }],
    ])("rejects %s", async (_name, change) => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
        payload: { ...validProduct, ...change },
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it("rejects a whitespace-only title the schema lets through", async () => {
      const updateProduct = vi.fn();
      const app = await buildApp("shop_admin", { catalogue: { updateProduct } });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/products/${PRODUCT}`,
        headers,
        payload: { ...validProduct, title: "   " },
      });
      expect(response.statusCode).toBe(400);
      expect(updateProduct).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe("archive and variants", () => {
    it("archives and restores a product", async () => {
      const setProductArchived = vi.fn(async (_input: { archived: boolean }) => ({
        version: VERSION,
      }));
      const app = await buildApp("shop_admin", { catalogue: { setProductArchived } });
      for (const segment of ["archive", "restore"]) {
        const response = await app.inject({
          method: "POST",
          url: `/admin/v1/merchandise/products/${PRODUCT}/${segment}`,
          headers,
        });
        expect(response.statusCode).toBe(200);
      }
      expect(setProductArchived.mock.calls.map(([call]) => call.archived)).toEqual([true, false]);
      await app.close();
    });

    it("adds a variant with a trimmed SKU", async () => {
      const addVariant = vi.fn(async () => ({ variantId: VARIANT }));
      const app = await buildApp("shop_admin", { catalogue: { addVariant } });
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/merchandise/products/${PRODUCT}/variants`,
        headers,
        payload: { sku: " TOTE-02 ", pricePence: 1800 },
      });
      expect(response.statusCode).toBe(200);
      expect(addVariant).toHaveBeenCalledWith(
        expect.objectContaining({ productId: PRODUCT, sku: "TOTE-02", pricePence: 1800 }),
      );
      await app.close();
    });

    it("answers a taken SKU with 409", async () => {
      const updateVariant = vi.fn(async () => {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, MERCHANDISE_SKU_IN_USE_MESSAGE, 409);
      });
      const app = await buildApp("shop_admin", { catalogue: { updateVariant } });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/variants/${VARIANT}`,
        headers,
        payload: { sku: "TOTE-02", pricePence: 1800 },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(MERCHANDISE_SKU_IN_USE_MESSAGE);
      await app.close();
    });

    it.each([
      ["a fractional price", { pricePence: 18.5 }],
      ["a negative price", { pricePence: -1 }],
      ["a price above the limit", { pricePence: 10_000_001 }],
      ["an empty SKU", { sku: "" }],
    ])("rejects %s", async (_name, change) => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/merchandise/variants/${VARIANT}`,
        headers,
        payload: { sku: "TOTE-02", pricePence: 1800, ...change },
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it("requires a reason to adjust stock", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/merchandise/variants/${VARIANT}/adjust-stock`,
        headers,
        payload: { onHand: 5 },
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
