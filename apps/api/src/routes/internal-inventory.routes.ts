import {
  AUCTION_SALES_SUBROUTE,
  DRAFT_LOT_SUBROUTE,
  draftLotRequestSchema,
  registerIdSchema,
} from "@auction/artwork-register-contracts";
import { Hono } from "hono";
import type { ContainerInternalInventoryRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInventoryMachineAuth } from "../middleware/inventory-machine-auth.js";

/**
 * LAX Bid's side of moving an original from lax.art to auction: which sales can take it, and the
 * draft lot made for it. Machine-authenticated with the credential LAX Shop shares (mounted under
 * `/internal/inventory` in app.ts); the paths and shapes come from the shared contract.
 */
export function createInternalInventoryRoutes(
  container: ContainerInternalInventoryRoutesSlice,
  env: Pick<Env, "INVENTORY_MACHINE_CLIENT_ID" | "INVENTORY_MACHINE_CLIENT_SECRET">,
) {
  const routes = new Hono();
  routes.use("*", createInventoryMachineAuth(env));

  routes.get(AUCTION_SALES_SUBROUTE, async (c) => {
    const sales = await container.inventoryMoves.draftLots.listSales();
    return c.json({ sales });
  });

  routes.post(DRAFT_LOT_SUBROUTE, async (c) => {
    const parsed = draftLotRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid_request", message: "The request was not understood." }, 400);
    }
    const outcome = await container.inventoryMoves.draftLots.createDraft(parsed.data);
    return outcome.ok ? c.json(outcome.data) : c.json(outcome.refusal, outcome.status);
  });

  routes.get(`${DRAFT_LOT_SUBROUTE}/:registerId`, async (c) => {
    const registerId = registerIdSchema.safeParse(c.req.param("registerId"));
    if (!registerId.success) {
      return c.json({ error: "invalid_request", message: "The request was not understood." }, 400);
    }
    return c.json({ lot: await container.inventoryMoves.draftLots.findDraft(registerId.data) });
  });

  return routes;
}
