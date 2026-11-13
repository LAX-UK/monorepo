import { PublicHomeCoverSchema } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";

/**
 * The picture that leads the Shop home's first screen, or `null` while the home leads with the
 * newest edition. Never cached here, so a change staff make shows as soon as the storefront asks.
 */
export async function registerHomeCoverRoutes(
  app: FastifyInstance,
  catalogue: Pick<CatalogueRoutesDeps, "homeCover">,
) {
  app.get(
    "/v1/home-cover",
    { schema: { tags: ["catalogue"], response: { 200: PublicHomeCoverSchema } } },
    async (_request, reply) => {
      reply.header("cache-control", "no-store");
      return catalogue.homeCover.read();
    },
  );
}
