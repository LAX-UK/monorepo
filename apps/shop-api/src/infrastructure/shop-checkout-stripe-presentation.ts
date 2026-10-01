import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopOrderLine, shopParty } from "@auction/db/schema";
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
  const rows = await db
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
    const existing = grouped.get(row.artworkId);
    if (existing) {
      existing.quantity += 1;
      existing.editionNumbers.push(row.editionNumber);
    } else {
      grouped.set(row.artworkId, {
        title: row.title,
        artistName: row.artistName,
        imageUrl: row.imageUrl,
        unitAmountPence: row.unitPricePence,
        quantity: 1,
        editionNumbers: [row.editionNumber],
      });
    }
  }

  return [...grouped.values()].map((line) => {
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
}
