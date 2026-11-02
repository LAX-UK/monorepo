import {
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, pence, workRef } from "../subject-export-values.js";
import { afterKey } from "./keyset.js";

type Origins = SubjectExportDeps["origins"];

export function mapBasketLine(
  row: {
    id: string;
    unitPricePence: number;
    quantity: number;
    createdAt: Date;
    artworkId: string | null;
    artworkTitle: string | null;
    artworkSlug: string | null;
    artworkChannel: "shop" | "art" | null;
    productTitle: string | null;
  },
  origins: Origins,
) {
  return {
    id: row.id,
    origin: "observed" as const,
    work: row.artworkId
      ? workRef(
          {
            id: row.artworkId,
            title: row.artworkTitle ?? "",
            slug: row.artworkSlug,
            salesChannel: row.artworkChannel,
          },
          origins,
        )
      : { id: row.id, title: row.productTitle ?? "", url: null },
    quantity: row.quantity,
    price: pence(row.unitPricePence),
    addedAt: isoRequired(row.createdAt),
  };
}

/** The person's open basket only; a basket held by a browser token alone is not linked to them. */
export class BasketCategory extends SourcedExportCategory {
  readonly id = "basket";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, origins }: SubjectExportDeps) {
    super();
    const open = (s: string) =>
      and(eq(shopBasket.identitySubjectId, s), isNull(shopBasket.retiredAt));
    this.sources = [
      {
        count: async (s) => {
          const [row] = await db
            .select({ n: count() })
            .from(shopBasketLine)
            .innerJoin(shopBasket, eq(shopBasket.id, shopBasketLine.basketId))
            .where(open(s));
          return Number(row?.n ?? 0);
        },
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopBasketLine.id,
              unitPricePence: shopBasketLine.unitPricePence,
              quantity: shopBasketLine.quantity,
              createdAt: shopBasketLine.createdAt,
              artworkId: shopArtwork.id,
              artworkTitle: shopArtwork.title,
              artworkSlug: shopArtwork.slug,
              artworkChannel: shopArtwork.salesChannel,
              productTitle: shopProduct.title,
            })
            .from(shopBasketLine)
            .innerJoin(shopBasket, eq(shopBasket.id, shopBasketLine.basketId))
            .leftJoin(shopArtwork, eq(shopArtwork.id, shopBasketLine.artworkId))
            .leftJoin(
              shopProductVariant,
              eq(shopProductVariant.id, shopBasketLine.productVariantId),
            )
            .leftJoin(shopProduct, eq(shopProduct.id, shopProductVariant.productId))
            .where(and(open(s), afterKey(shopBasketLine.id, after)))
            .orderBy(asc(shopBasketLine.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapBasketLine(row, origins) }));
        },
      },
    ];
  }
}
