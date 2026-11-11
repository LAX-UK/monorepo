import { z } from "zod";
import { zValidator } from "../../lib/z-validator.js";
import { requireLotsRead, requirePlatformAdminFull } from "../../middleware/require-capability.js";
import type { AdminInventoryRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

const blockPublishingBodySchema = z.object({ blockPublishing: z.boolean() });

/**
 * Originals that are live without a Zoho record, and the switch that stops LAX Bid publishing
 * more of them. Anyone who may see lots can read the report; only an administrator changes the
 * switch.
 */
export function attachAdminUnlinkedOriginalsRoutes(
  platform: AdminHono,
  container: AdminInventoryRoutesContainer,
): void {
  const service = container.admin.inventoryMoves.unlinkedOriginals;

  platform.get("/inventory/unlinked-originals", requireLotsRead, async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ data: await service.view() });
  });

  platform.put(
    "/inventory/unlinked-originals/block-publishing",
    requirePlatformAdminFull,
    zValidator("json", blockPublishingBodySchema),
    async (c) => {
      const { blockPublishing } = c.req.valid("json");
      return c.json({
        data: await service.setBlockPublishing(blockPublishing, c.get("userId") as string),
      });
    },
  );
}
