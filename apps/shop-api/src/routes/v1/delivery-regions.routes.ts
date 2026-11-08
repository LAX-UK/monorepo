import { PublicDeliveryRegionsSchema } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";
import { presentPublicDeliveryRegions } from "../../presenters/delivery-regions.presenter.js";

/**
 * Where the Shop delivers and how long it takes, for the storefront's delivery page and, later,
 * checkout. The same facts the delivery page tells buyers; never cached, so a change staff make
 * shows at once.
 */
export async function registerDeliveryRegionRoutes(
  app: FastifyInstance,
  catalogue: Pick<CatalogueRoutesDeps, "deliveryRegions">,
) {
  app.get(
    "/v1/delivery-regions",
    { schema: { tags: ["catalogue"], response: { 200: PublicDeliveryRegionsSchema } } },
    async () => presentPublicDeliveryRegions(await catalogue.deliveryRegions.read()),
  );
}
