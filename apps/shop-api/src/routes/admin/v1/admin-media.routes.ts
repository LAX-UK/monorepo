import { SHOP_API_ERROR_CODES, ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { STAFF_MEDIA_KINDS } from "../../../domain/shop-media-upload-policy.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const PresignBodySchema = Type.Object({
  kind: Type.Union(STAFF_MEDIA_KINDS.map((kind) => Type.Literal(kind))),
  contentType: Type.String({ minLength: 3, maxLength: 100 }),
  byteSize: Type.Integer({ minimum: 1 }),
});

const PresignResponseSchema = Type.Object({
  key: Type.String(),
  uploadUrl: Type.String(),
  publicUrl: Type.String(),
  requiredHeaders: Type.Record(Type.String(), Type.String()),
});

const ConfirmBodySchema = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 512 }),
  alt: Type.Optional(Type.String({ maxLength: 500 })),
});

const ConfirmResponseSchema = Type.Object({
  key: Type.String(),
  publicUrl: Type.String(),
  width: Type.Integer({ minimum: 1 }),
  height: Type.Integer({ minimum: 1 }),
  blurDataUrl: Type.String(),
  alt: Type.Union([Type.String(), Type.Null()]),
});

export async function registerAdminMediaRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/media/presign",
    {
      schema: {
        tags: ["shop-admin"],
        body: PresignBodySchema,
        response: {
          200: PresignResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const subject = requireShopAdminSubject(request);
      const handlers = deps.shopMediaUpload;
      if (!handlers) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
          "Shop media uploads are not configured",
          503,
        );
      }
      const body = request.body as {
        kind: (typeof STAFF_MEDIA_KINDS)[number];
        contentType: string;
        byteSize: number;
      };
      return handlers.presign({
        kind: body.kind,
        contentType: body.contentType,
        byteSize: body.byteSize,
        subjectId: subject,
      });
    },
  );

  app.post(
    "/media/confirm",
    {
      schema: {
        tags: ["shop-admin"],
        body: ConfirmBodySchema,
        response: {
          200: ConfirmResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      requireShopAdminSubject(request);
      const handlers = deps.shopMediaUpload;
      if (!handlers) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
          "Shop media uploads are not configured",
          503,
        );
      }
      const body = request.body as { key: string; alt?: string };
      return handlers.confirm({
        key: body.key,
        alt: body.alt ?? null,
      });
    },
  );
}
