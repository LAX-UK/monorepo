import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";

const MerchandiseListResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      productId: Type.String({ format: "uuid" }),
      slug: Type.String(),
      title: Type.String(),
    }),
  ),
});

/** Stub list until merchandise admin CRUD is implemented. */
export async function registerAdminMerchandiseRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/v1/merchandise/products",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: MerchandiseListResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async () => ({ items: [] }),
  );
}
