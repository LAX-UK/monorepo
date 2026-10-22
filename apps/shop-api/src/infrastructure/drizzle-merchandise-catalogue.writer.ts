import { shopProduct, shopProductVariant } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import type { MerchandiseCatalogueWriter } from "../application/ports/merchandise-catalogue.writer.js";
import type {
  ShopTransactionEffects,
  ShopUnitOfWorkFactory,
} from "../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { StaleVersionError } from "../errors/stale-version-error.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";
import { withUniqueValueConflict } from "./merchandise-unique-violation.js";

async function lockProduct(tx: ShopTransactionEffects, productId: string) {
  const [product] = await shopPhaseDbSession(tx)
    .select()
    .from(shopProduct)
    .where(eq(shopProduct.id, productId))
    .for("update")
    .limit(1);
  if (!product) throw notFound("Product not found");
  return product;
}

async function lockVariant(tx: ShopTransactionEffects, variantId: string) {
  const [variant] = await shopPhaseDbSession(tx)
    .select()
    .from(shopProductVariant)
    .where(eq(shopProductVariant.id, variantId))
    .for("update")
    .limit(1);
  if (!variant) throw notFound("Variant not found");
  return variant;
}

function variantAudit(variant: { sku: string; pricePence: number; archivedAt: Date | null }) {
  return {
    sku: variant.sku,
    pricePence: variant.pricePence,
    archived: variant.archivedAt !== null,
  };
}

export function createDrizzleMerchandiseCatalogueWriter(
  uow: ShopUnitOfWorkFactory,
): MerchandiseCatalogueWriter {
  return {
    updateProduct: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.update_product",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockProduct(tx, input.productId);
            // Versions travel as millisecond ISO strings; the column holds microseconds.
            if (before.updatedAt.getTime() !== new Date(input.expectedVersion).getTime()) {
              throw new StaleVersionError("This product", before.updatedAt.toISOString());
            }
            const [after] = await withUniqueValueConflict(() =>
              shopPhaseDbSession(tx)
                .update(shopProduct)
                .set({
                  slug: input.slug,
                  title: input.title,
                  description: input.description,
                  updatedAt: new Date(),
                })
                .where(eq(shopProduct.id, input.productId))
                .returning({ updatedAt: shopProduct.updatedAt }),
            );
            if (!after) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to save product", 500);
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: "update_merchandise_product",
              targetType: "shop_product",
              targetId: input.productId,
              beforeJson: {
                slug: before.slug,
                title: before.title,
                description: before.description,
              },
              afterJson: {
                slug: input.slug,
                title: input.title,
                description: input.description,
              },
            });
            return { version: after.updatedAt.toISOString() };
          },
        }),
      ),

    setProductArchived: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.set_product_archived",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockProduct(tx, input.productId);
            if ((before.archivedAt !== null) === input.archived) {
              return { version: before.updatedAt.toISOString() };
            }
            const now = new Date();
            const [after] = await shopPhaseDbSession(tx)
              .update(shopProduct)
              .set({ archivedAt: input.archived ? now : null, updatedAt: now })
              .where(eq(shopProduct.id, input.productId))
              .returning({ updatedAt: shopProduct.updatedAt });
            if (!after) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to save product", 500);
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: input.archived
                ? "archive_merchandise_product"
                : "restore_merchandise_product",
              targetType: "shop_product",
              targetId: input.productId,
              beforeJson: { archived: !input.archived },
              afterJson: { archived: input.archived },
            });
            return { version: after.updatedAt.toISOString() };
          },
        }),
      ),

    addVariant: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.add_variant",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            await lockProduct(tx, input.productId);
            // Stock starts at zero: quantities only enter through the recorded stock adjustment.
            const [variant] = await withUniqueValueConflict(() =>
              shopPhaseDbSession(tx)
                .insert(shopProductVariant)
                .values({
                  productId: input.productId,
                  sku: input.sku,
                  pricePence: input.pricePence,
                  onHand: 0,
                })
                .returning({ id: shopProductVariant.id }),
            );
            if (!variant) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.INTERNAL,
                "Failed to create variant",
                500,
              );
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: "add_merchandise_variant",
              targetType: "shop_product_variant",
              targetId: variant.id,
              afterJson: {
                productId: input.productId,
                sku: input.sku,
                pricePence: input.pricePence,
              },
            });
            return { variantId: variant.id };
          },
        }),
      ),

    updateVariant: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.update_variant",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockVariant(tx, input.variantId);
            await withUniqueValueConflict(() =>
              shopPhaseDbSession(tx)
                .update(shopProductVariant)
                .set({ sku: input.sku, pricePence: input.pricePence, updatedAt: new Date() })
                .where(eq(shopProductVariant.id, input.variantId)),
            );
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: "update_merchandise_variant",
              targetType: "shop_product_variant",
              targetId: input.variantId,
              beforeJson: variantAudit(before),
              afterJson: variantAudit({ ...before, sku: input.sku, pricePence: input.pricePence }),
            });
            return { variantId: input.variantId };
          },
        }),
      ),

    setVariantArchived: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "merchandise.set_variant_archived",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockVariant(tx, input.variantId);
            if ((before.archivedAt !== null) === input.archived) {
              return { variantId: input.variantId };
            }
            const now = new Date();
            await shopPhaseDbSession(tx)
              .update(shopProductVariant)
              .set({ archivedAt: input.archived ? now : null, updatedAt: now })
              .where(eq(shopProductVariant.id, input.variantId));
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "merchandise.write",
              action: input.archived
                ? "archive_merchandise_variant"
                : "restore_merchandise_variant",
              targetType: "shop_product_variant",
              targetId: input.variantId,
              beforeJson: variantAudit(before),
              afterJson: variantAudit({ ...before, archivedAt: input.archived ? now : null }),
            });
            return { variantId: input.variantId };
          },
        }),
      ),
  };
}
