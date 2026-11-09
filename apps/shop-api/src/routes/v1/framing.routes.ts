import { PublicEditionFramingSchema, ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { presentPublicFraming } from "../../application/framing/edition-framing.view.js";
import type { PublicFramingRoutesDeps } from "../../framing-route-deps.js";

const NONE = { kind: "none", required: false, description: null, options: [] } as const;

/**
 * What a buyer can choose for framing on an edition. With framing switched off, or for an edition
 * that offers none, the answer is "none", so the edition page is as it always was. Prices are
 * worked out here; the page only shows them.
 */
export async function registerPublicFramingRoutes(
  app: FastifyInstance,
  deps: PublicFramingRoutesDeps,
) {
  app.get(
    "/v1/artworks/:slug/framing",
    {
      schema: {
        tags: ["catalogue"],
        params: Type.Object({ slug: Type.String({ minLength: 1, maxLength: 200 }) }),
        response: { 200: PublicEditionFramingSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      if (!deps.framingEnabled) return NONE;
      const { slug } = request.params as { slug: string };
      const facts = await deps.reader.readBySlug(slug);
      return facts ? presentPublicFraming(facts) : NONE;
    },
  );
}
