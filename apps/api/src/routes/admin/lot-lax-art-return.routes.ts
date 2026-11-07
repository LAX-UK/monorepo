import { lotIdOnlyParamSchema } from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuctionManage, requireLotWorkRead } from "../../middleware/require-capability.js";
import type { AdminInventoryRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

/** A lot's way back to lax.art, for lots that ended unsold, were withdrawn or voided. */
export function attachAdminLotLaxArtReturnRoutes(
  platform: AdminHono,
  container: AdminInventoryRoutesContainer,
): void {
  /** GET /admin/lots/:lotId/lax-art-return: whether this lot can go back to lax.art, and why not. */
  platform.get(
    "/lots/:lotId/lax-art-return",
    requireLotWorkRead,
    zValidator("param", lotIdOnlyParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      return c.json({ data: await container.admin.inventoryMoves.returnToLaxArt.describe(lotId) });
    },
  );

  /** POST /admin/lots/:lotId/return-to-lax-art: reopen the artwork's lax.art listing as a draft. */
  platform.post(
    "/lots/:lotId/return-to-lax-art",
    requireAuctionManage,
    zValidator("param", lotIdOnlyParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const result = await container.admin.inventoryMoves.returnToLaxArt.returnToLaxArt(
        lotId,
        c.get("userId") as string,
      );
      if (result.ok) {
        return c.json({
          data: {
            reopened: result.reopened,
            laxArtListing: result.laxArtListing,
            ...(result.hint ? { hint: result.hint } : {}),
          },
        });
      }
      return c.json(
        {
          error: result.error,
          code: result.code,
          ...(result.laxArtListing === false ? { laxArtListing: false } : {}),
          ...(result.hint ? { hint: result.hint } : {}),
        },
        result.status,
      );
    },
  );
}
