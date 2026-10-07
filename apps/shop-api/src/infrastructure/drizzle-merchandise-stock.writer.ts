import { shopProductVariant } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../application/admin/operator-context.js";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import type { MerchandiseStockWriter } from "../application/ports/merchandise-stock.writer.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

export function createDrizzleMerchandiseStockWriter(
  uow: ShopUnitOfWorkFactory,
): MerchandiseStockWriter {
  return {
    adjustVariantOnHand: (input) =>
      uow.run(async (tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.adjust_stock",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            if (!Number.isInteger(input.onHand) || input.onHand < 0) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.VALIDATION,
                "Invalid on-hand quantity",
                400,
              );
            }
            const [variant] = await shopPhaseDbSession(tx)
              .select({
                id: shopProductVariant.id,
                onHand: shopProductVariant.onHand,
                reserved: shopProductVariant.reserved,
              })
              .from(shopProductVariant)
              .where(eq(shopProductVariant.id, input.variantId))
              .for("update")
              .limit(1);
            if (!variant) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Variant not found", 404);
            }
            if (input.onHand < variant.reserved) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "On-hand cannot fall below reserved stock",
                409,
              );
            }
            const [updated] = await shopPhaseDbSession(tx)
              .update(shopProductVariant)
              .set({ onHand: input.onHand, updatedAt: new Date() })
              .where(eq(shopProductVariant.id, input.variantId))
              .returning({ id: shopProductVariant.id, onHand: shopProductVariant.onHand });
            if (!updated) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to adjust stock", 500);
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: "adjust_merchandise_stock",
              targetType: "shop_product_variant",
              targetId: input.variantId,
              beforeJson: {
                onHand: variant.onHand,
                reserved: variant.reserved,
                ...operatorContextAuditFields(undefined),
              },
              afterJson: {
                onHand: updated.onHand,
                reserved: variant.reserved,
                ...operatorContextAuditFields(undefined),
              },
            });
            return { variantId: updated.id, onHand: updated.onHand };
          },
        }),
      ),
  };
}
