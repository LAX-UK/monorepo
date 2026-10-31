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

export type CheckoutEditionRow = {
  artworkId: string | null;
  /** Null for an unnumbered run: an open edition or an unnumbered proof. */
  editionNumber: number | null;
  unitPricePence: number;
  title: string;
  imageUrl: string | null;
  artistName: string;
};

/**
 * The payment page's lines for the order's editions: one per artwork and price, so every
 * edition the order charges for is shown and the lines always add up to the order total.
 * Numbered editions name their numbers; unnumbered ones (open editions, proofs) do not.
 */
export function groupCheckoutEditionLines(
  rows: readonly CheckoutEditionRow[],
): CheckoutStripeLine[] {
  const grouped = new Map<
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

  for (const row of rows) {
    if (row.artworkId === null) continue;
    const key = `${row.artworkId}:${row.unitPricePence}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      if (row.editionNumber !== null) existing.editionNumbers.push(row.editionNumber);
    } else {
      grouped.set(key, {
        title: row.title,
        artistName: row.artistName,
        imageUrl: row.imageUrl,
        unitAmountPence: row.unitPricePence,
        quantity: 1,
        editionNumbers: row.editionNumber === null ? [] : [row.editionNumber],
      });
    }
  }

  return [...grouped.values()].map((line) => {
    const numbers = [...line.editionNumbers].sort((a, b) => a - b);
    const editionLabel =
      numbers.length === 0
        ? null
        : numbers.length > 1
          ? `Editions ${numbers.join(", ")}`
          : `Edition ${numbers[0]}`;
    return {
      title: line.title,
      description: editionLabel ? `${line.artistName} · ${editionLabel}` : line.artistName,
      quantity: line.quantity,
      unitAmountPence: line.unitAmountPence,
      imageUrl: line.imageUrl,
    };
  });
}

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

  const editionLines = groupCheckoutEditionLines(editionRows);

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
