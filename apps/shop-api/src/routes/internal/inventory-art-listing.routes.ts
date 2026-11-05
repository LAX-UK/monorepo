import {
  ART_LISTING_REOPEN_SUBROUTE,
  INVENTORY_INTERNAL_PREFIX,
  reopenListingRequestSchema,
} from "@auction/artwork-register-contracts";
import type { FastifyInstance } from "fastify";
import type { InventoryRouteDeps } from "../../inventory-route-deps.js";
import { inventoryMachineStatus } from "./machine-client-auth.js";

/**
 * LAX Shop's side of returning an original from LAX Bid: reopen its lax.art listing as a draft.
 * Machine-authenticated with the credential LAX Bid shares; the path and shapes come from the
 * shared contract. The listing is never published here.
 */
export async function registerInventoryArtListingRoutes(
  app: FastifyInstance,
  deps: InventoryRouteDeps,
): Promise<void> {
  app.post(`${INVENTORY_INTERNAL_PREFIX}${ART_LISTING_REOPEN_SUBROUTE}`, async (request, reply) => {
    const status = inventoryMachineStatus(request, deps.machine);
    if (status === 503) {
      return reply.status(503).send({
        error: "not_configured",
        message: "Moving artworks between products is not set up.",
      });
    }
    if (status === 401) return reply.status(401).send({ error: "unauthorized" });

    const parsed = reopenListingRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "invalid_request", message: "The request was not understood." });
    }
    const outcome = await deps.reopen.reopen(parsed.data);
    reply.header("cache-control", "no-store");
    return outcome.ok
      ? reply.send(outcome.data)
      : reply.status(outcome.status).send(outcome.refusal);
  });
}
