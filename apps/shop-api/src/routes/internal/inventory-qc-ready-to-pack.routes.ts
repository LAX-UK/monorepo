import {
  INVENTORY_INTERNAL_PREFIX,
  QC_READY_TO_PACK_SUBROUTE,
  qcReadyToPackRequestSchema,
} from "@auction/artwork-register-contracts";
import type { FastifyInstance } from "fastify";
import type { InventoryRouteDeps } from "../../inventory-route-deps.js";
import { inventoryMachineStatus } from "./machine-client-auth.js";

/**
 * Zoho says a print's quality check passed; LAX Shop moves the print's production task on. Machine-
 * authenticated with the inventory credential. The answer says what happened and is always 200, so
 * the worker, not the transport, decides which outcomes need staff.
 */
export async function registerInventoryQcReadyToPackRoutes(
  app: FastifyInstance,
  deps: InventoryRouteDeps,
): Promise<void> {
  app.post(`${INVENTORY_INTERNAL_PREFIX}${QC_READY_TO_PACK_SUBROUTE}`, async (request, reply) => {
    const status = inventoryMachineStatus(request, deps.machine);
    if (status === 503) {
      return reply.status(503).send({
        error: "not_configured",
        message: "Moving a print on after a Zoho quality check is not set up.",
      });
    }
    if (status === 401) return reply.status(401).send({ error: "unauthorized" });

    const parsed = qcReadyToPackRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "invalid_request", message: "The request was not understood." });
    }
    reply.header("cache-control", "no-store");
    return reply.send({ outcome: await deps.qcReady.markPassed(parsed.data) });
  });
}
