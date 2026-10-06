import type { Database } from "@auction/db";
import { shopEdition, shopOrderLine, shopProductVariant } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type VatPolicy, computeLineVat } from "@auction/shop-domain";
import { and, eq, sql } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgDeadlockDetected } from "../lib/pg-errors.js";
import type { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import { sellableEditionCondition } from "./shop-edition-availability.js";

export async function reserveEditionsForCheckoutOrder(
  tx: Database,
  input: {
    orderId: string;
    reservedUntil: Date;
    expandedLines: Array<{ artworkId: string; unitPricePence: number }>;
    vatPolicy?: VatPolicy | null;
  },
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  for (const line of input.expandedLines) {
    const picked = await tx
      .select({
        id: shopEdition.id,
        ownerPartyId: shopEdition.ownerPartyId,
        editionNumber: shopEdition.editionNumber,
      })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, line.artworkId), sellableEditionCondition()))
      .orderBy(shopEdition.saleAuthorisedAt, shopEdition.editionNumber)
      .limit(1)
      .for("update", { skipLocked: true });
    const edition = picked[0];
    if (!edition?.ownerPartyId) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Edition unavailable", 409);
    }
    await tx
      .update(shopEdition)
      .set({
        listingStatus: "reserved",
        reservedUntil: input.reservedUntil,
        reservedByOrderId: input.orderId,
      })
      .where(eq(shopEdition.id, edition.id));
    const vat = computeLineVat(input.vatPolicy ?? null, { unitPricePence: line.unitPricePence });
    await tx.insert(shopOrderLine).values({
      orderId: input.orderId,
      editionId: edition.id,
      artworkId: line.artworkId,
      sellerPartyId: edition.ownerPartyId,
      editionNumber: edition.editionNumber,
      unitPricePence: line.unitPricePence,
      ...(vat.ok
        ? {
            vatTreatment: vat.vatTreatment,
            vatRateBp: vat.vatRateBp,
            vatPence: vat.vatPence,
          }
        : {}),
    });
    await events.insertInTransaction(tx, {
      aggregateType: "shop_edition",
      aggregateId: edition.id,
      eventType: "shop.edition.reserved",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        orderId: input.orderId,
        artworkId: line.artworkId,
        editionNumber: edition.editionNumber,
      },
    });
  }
}

function groupExpandedVariantLines(
  expandedLines: Array<{ productVariantId: string; unitPricePence: number }>,
): Array<{ productVariantId: string; unitPricePence: number; quantity: number }> {
  const byVariant = new Map<string, { unitPricePence: number; quantity: number }>();
  for (const line of expandedLines) {
    const existing = byVariant.get(line.productVariantId);
    if (existing) {
      existing.quantity += 1;
    } else {
      byVariant.set(line.productVariantId, {
        unitPricePence: line.unitPricePence,
        quantity: 1,
      });
    }
  }
  return [...byVariant.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productVariantId, { unitPricePence, quantity }]) => ({
      productVariantId,
      unitPricePence,
      quantity,
    }));
}

export async function reserveProductVariantsForCheckoutOrder(
  tx: Database,
  input: {
    orderId: string;
    expandedLines: Array<{ productVariantId: string; unitPricePence: number }>;
    vatPolicy?: VatPolicy | null;
  },
): Promise<void> {
  const grouped = groupExpandedVariantLines(input.expandedLines);
  try {
    for (const group of grouped) {
      const [updated] = await tx
        .update(shopProductVariant)
        .set({
          reserved: sql`${shopProductVariant.reserved} + ${group.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shopProductVariant.id, group.productVariantId),
            sql`${shopProductVariant.onHand} - ${shopProductVariant.reserved} >= ${group.quantity}`,
          ),
        )
        .returning({ id: shopProductVariant.id });
      if (!updated) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Variant unavailable", 409);
      }
      const vat = computeLineVat(input.vatPolicy ?? null, {
        unitPricePence: group.unitPricePence,
      });
      for (let i = 0; i < group.quantity; i += 1) {
        await tx.insert(shopOrderLine).values({
          orderId: input.orderId,
          productVariantId: group.productVariantId,
          unitPricePence: group.unitPricePence,
          ...(vat.ok
            ? {
                vatTreatment: vat.vatTreatment,
                vatRateBp: vat.vatRateBp,
                vatPence: vat.vatPence,
              }
            : {}),
        });
      }
    }
  } catch (error) {
    if (error instanceof ShopApiError) throw error;
    if (isPgDeadlockDetected(error)) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Checkout conflict", 409);
    }
    throw error;
  }
}
