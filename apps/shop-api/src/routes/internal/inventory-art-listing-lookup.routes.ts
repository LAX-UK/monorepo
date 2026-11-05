import {
  ART_LISTING_LOOKUP_SUBROUTE,
  INVENTORY_INTERNAL_PREFIX,
  artListingLookupRequestSchema,
} from "@auction/artwork-register-contracts";
import type { FastifyInstance } from "fastify";
import type { InventoryRouteDeps } from "../../inventory-route-deps.js";
import { inventoryMachineStatus } from "./machine-client-auth.js";

/**
 * What lax.art holds for a set of originals, so the worker can tell Zoho where each one is and
 * link to it. Machine-authenticated with the inventory credential; it reads and never changes.
 */
export async function registerInventoryArtListingLookupRoutes(
  app: FastifyInstance,
  deps: InventoryRouteDeps,
): Promise<void> {
  app.post(`${INVENTORY_INTERNAL_PREFIX}${ART_LISTING_LOOKUP_SUBROUTE}`, async (request, reply) => {
    const status = inventoryMachineStatus(request, deps.machine);
    if (status === 503) {
      return reply.status(503).send({
        error: "not_configured",
        message: "Moving artworks between products is not set up.",
      });
    }
    if (status === 401) return reply.status(401).send({ error: "unauthorized" });

    const parsed = artListingLookupRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "invalid_request", message: "The request was not understood." });
    }
    const listings = await deps.lookup.findByZohoProductIds(parsed.data.zohoProductIds);
    reply.header("cache-control", "no-store");
    return reply.send({ listings });
  });
}
