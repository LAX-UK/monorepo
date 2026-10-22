import {
  MerchandiseAdjustStockBodySchema,
  MerchandiseAdjustStockResponseSchema,
  MerchandiseConflictBodySchema,
  MerchandiseProductCreateBodySchema,
  MerchandiseProductCreateResponseSchema,
  MerchandiseProductDetailSchema,
  MerchandiseProductListQuerySchema,
  MerchandiseProductListSchema,
  MerchandiseProductUpdateBodySchema,
  MerchandiseVariantBodySchema,
  MerchandiseVariantResponseSchema,
  MerchandiseVersionResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { cleanProductFields, cleanSku } from "../../../application/admin/merchandise-input.js";
import { notFound } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const ProductParams = Type.Object({ productId: Type.String({ format: "uuid" }) });
const VariantParams = Type.Object({ variantId: Type.String({ format: "uuid" }) });

const WRITE_ERRORS = {
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: MerchandiseConflictBodySchema,
} as const;

/** Who is writing and under which idempotency key; every merchandise write needs both. */
function writer(request: FastifyRequest) {
  requireShopStaffCapability(request, "merchandise.write");
  return {
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  };
}

export async function registerAdminMerchandiseRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  const catalogue = deps.merchandiseCatalogue;

  app.get(
    "/merchandise/products",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: MerchandiseProductListQuerySchema,
        response: { 200: MerchandiseProductListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "merchandise.read");
      return deps.adminRead.catalogue.listMerchandiseProducts(
        request.query as Static<typeof MerchandiseProductListQuerySchema>,
      );
    },
  );

  app.get(
    "/merchandise/products/:productId",
    {
      schema: {
        tags: ["shop-admin"],
        params: ProductParams,
        response: {
          200: MerchandiseProductDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "merchandise.read");
      const { productId } = request.params as Static<typeof ProductParams>;
      const product = await deps.adminRead.catalogue.getMerchandiseProduct(productId);
      if (!product) throw notFound("Product not found");
      return product;
    },
  );

  app.post(
    "/merchandise/products",
    {
      schema: {
        tags: ["shop-admin"],
        body: MerchandiseProductCreateBodySchema,
        response: { 200: MerchandiseProductCreateResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = writer(request);
      const body = request.body as Static<typeof MerchandiseProductCreateBodySchema>;
      return deps.createMerchandiseProduct({ ...body, ...actor });
    },
  );

  app.put(
    "/merchandise/products/:productId",
    {
      schema: {
        tags: ["shop-admin"],
        params: ProductParams,
        body: MerchandiseProductUpdateBodySchema,
        response: { 200: MerchandiseVersionResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = writer(request);
      const { productId } = request.params as Static<typeof ProductParams>;
      const body = request.body as Static<typeof MerchandiseProductUpdateBodySchema>;
      return catalogue.updateProduct({
        ...actor,
        productId,
        ...cleanProductFields(body),
        expectedVersion: body.expectedVersion,
      });
    },
  );

  for (const [segment, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post(
      `/merchandise/products/:productId/${segment}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: ProductParams,
          response: { 200: MerchandiseVersionResponseSchema, ...WRITE_ERRORS },
        },
      },
      async (request) => {
        const actor = writer(request);
        const { productId } = request.params as Static<typeof ProductParams>;
        return catalogue.setProductArchived({ ...actor, productId, archived });
      },
    );
  }

  app.post(
    "/merchandise/products/:productId/variants",
    {
      schema: {
        tags: ["shop-admin"],
        params: ProductParams,
        body: MerchandiseVariantBodySchema,
        response: { 200: MerchandiseVariantResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = writer(request);
      const { productId } = request.params as Static<typeof ProductParams>;
      const body = request.body as Static<typeof MerchandiseVariantBodySchema>;
      return catalogue.addVariant({
        ...actor,
        productId,
        sku: cleanSku(body.sku),
        pricePence: body.pricePence,
      });
    },
  );

  app.put(
    "/merchandise/variants/:variantId",
    {
      schema: {
        tags: ["shop-admin"],
        params: VariantParams,
        body: MerchandiseVariantBodySchema,
        response: { 200: MerchandiseVariantResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = writer(request);
      const { variantId } = request.params as Static<typeof VariantParams>;
      const body = request.body as Static<typeof MerchandiseVariantBodySchema>;
      return catalogue.updateVariant({
        ...actor,
        variantId,
        sku: cleanSku(body.sku),
        pricePence: body.pricePence,
      });
    },
  );

  for (const [segment, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post(
      `/merchandise/variants/:variantId/${segment}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: VariantParams,
          response: { 200: MerchandiseVariantResponseSchema, ...WRITE_ERRORS },
        },
      },
      async (request) => {
        const actor = writer(request);
        const { variantId } = request.params as Static<typeof VariantParams>;
        return catalogue.setVariantArchived({ ...actor, variantId, archived });
      },
    );
  }

  app.post(
    "/merchandise/variants/:variantId/adjust-stock",
    {
      schema: {
        tags: ["shop-admin"],
        params: VariantParams,
        body: MerchandiseAdjustStockBodySchema,
        response: { 200: MerchandiseAdjustStockResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = writer(request);
      const { variantId } = request.params as Static<typeof VariantParams>;
      const body = request.body as Static<typeof MerchandiseAdjustStockBodySchema>;
      return deps.adjustMerchandiseStock({
        ...actor,
        variantId,
        onHand: body.onHand,
        reason: body.reason,
      });
    },
  );
}
