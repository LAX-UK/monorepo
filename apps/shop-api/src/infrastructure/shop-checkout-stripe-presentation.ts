import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopOrderLine,
  shopParty,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";

export type CheckoutStripeLine = {
  title: string;
  description: string;
  quantity: number;
  unitAmountPence: number;
  imageUrl: string | null;
};

export async function loadCheckoutStripePresentation(
  db: Database,
  orderId: string,
): Promise<CheckoutStripeLine[]> {
  const editionRows = await db
    .select({
      artworkId: shopOrderLine.artworkId,
      editionNumber: shopOrderLine.editionNumber,
      unitPricePence: shopOrderLine.unitPricePence,
      title: shopArtwork.title,
      imageUrl: shopArtwork.primaryImageUrl,
      artistName: shopParty.displayName,
    })
    .from(shopOrderLine)
    .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
    .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
    .where(eq(shopOrderLine.orderId, orderId));

  const variantRows = await db
    .select({
      productVariantId: shopOrderLine.productVariantId,
      unitPricePence: shopOrderLine.unitPricePence,
      productTitle: shopProduct.title,
      variantSku: shopProductVariant.sku,
    })
    .from(shopOrderLine)
    .innerJoin(shopProductVariant, eq(shopOrderLine.productVariantId, shopProductVariant.id))
    .innerJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(eq(shopOrderLine.orderId, orderId));

  const groupedEditions = new Map<
    string,
    {
      title: string;
      artistName: string;
      imageUrl: string | null;
      unitAmountPence: number;
      quantity: number;
      editionNumbers: number[];
    }
  >();

  for (const row of editionRows) {
    if (row.artworkId === null || row.editionNumber === null) {
      continue;
    }
    const existing = groupedEditions.get(row.artworkId);
    if (existing) {
      existing.quantity += 1;
      existing.editionNumbers.push(row.editionNumber);
    } else {
      groupedEditions.set(row.artworkId, {
        title: row.title,
        artistName: row.artistName,
        imageUrl: row.imageUrl,
        unitAmountPence: row.unitPricePence,
        quantity: 1,
        editionNumbers: [row.editionNumber],
      });
    }
  }

  const editionLines = [...groupedEditions.values()].map((line) => {
    const sortedEditions = [...line.editionNumbers].sort((a, b) => a - b);
    const editionLabel =
      sortedEditions.length > 1
        ? `Editions ${sortedEditions.join(", ")}`
        : `Edition ${sortedEditions[0]}`;
    return {
      title: line.title,
      description: `${line.artistName} · ${editionLabel}`,
      quantity: line.quantity,
      unitAmountPence: line.unitAmountPence,
      imageUrl: line.imageUrl,
    };
  });

  const groupedVariants = new Map<
    string,
    {
      productTitle: string;
      variantSku: string;
      unitAmountPence: number;
      quantity: number;
    }
  >();

  for (const row of variantRows) {
    if (!row.productVariantId) {
      continue;
    }
    const existing = groupedVariants.get(row.productVariantId);
    if (existing) {
      existing.quantity += 1;
    } else {
      groupedVariants.set(row.productVariantId, {
        productTitle: row.productTitle,
        variantSku: row.variantSku,
        unitAmountPence: row.unitPricePence,
        quantity: 1,
      });
    }
  }

  const variantLines = [...groupedVariants.values()].map((line) => ({
    title: line.productTitle,
    description: `SKU ${line.variantSku}`,
    quantity: line.quantity,
    unitAmountPence: line.unitAmountPence,
    imageUrl: null,
  }));

  return [...editionLines, ...variantLines];
}
