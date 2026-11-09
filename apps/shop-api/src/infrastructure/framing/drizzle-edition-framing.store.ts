import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEditionFraming,
  shopFramingEditionOffer,
  shopFramingOption,
  shopFramingOptionPrice,
} from "@auction/db/schema";
import {
  FRAMING_BAND_CODES,
  type FramingBandCode,
  type FramingFrame,
  type FramingGlazing,
  type FramingHanging,
  type FramingMode,
  type FramingMount,
  type FramingPrices,
  type FramingStatus,
} from "@auction/shop-domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  CatalogueOptionFacts,
  EditionFramingFacts,
  EditionFramingOfferFacts,
  EditionFramingReader,
  EditionFramingStore,
} from "../../application/framing/edition-framing.ports.js";
import { publicArtworkVisible } from "../artwork-visibility-sql.js";

type OptionRow = typeof shopFramingOption.$inferSelect;

async function optionFacts(
  db: Database,
  rows: readonly OptionRow[],
): Promise<Map<string, CatalogueOptionFacts>> {
  const ids = rows.map((row) => row.id);
  const priceRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(shopFramingOptionPrice)
          .where(inArray(shopFramingOptionPrice.optionId, ids));
  const prices = new Map<string, Partial<FramingPrices>>();
  const placeholders = new Map<string, FramingBandCode[]>();
  for (const row of priceRows) {
    const band = row.band as FramingBandCode;
    prices.set(row.optionId, { ...prices.get(row.optionId), [band]: row.pricePence });
    if (row.isPlaceholder)
      placeholders.set(row.optionId, [...(placeholders.get(row.optionId) ?? []), band]);
  }
  const facts = new Map<string, CatalogueOptionFacts>();
  for (const row of rows) {
    const bandPrices = prices.get(row.id);
    // An option missing a band's price cannot be priced, so it is never shown or offered.
    if (!bandPrices || !FRAMING_BAND_CODES.every((band) => bandPrices[band] !== undefined)) {
      continue;
    }
    facts.set(row.id, {
      optionId: row.id,
      name: row.name,
      frame: row.frame as FramingFrame,
      mount: row.mount as FramingMount,
      glazing: row.glazing as FramingGlazing,
      hanging: row.hanging as FramingHanging,
      leadTimeMinDays: row.leadTimeMinDays,
      leadTimeMaxDays: row.leadTimeMaxDays,
      status: row.status as FramingStatus,
      placeholderBands: placeholders.get(row.id) ?? [],
      pricesPence: bandPrices as FramingPrices,
    });
  }
  return facts;
}

async function readFacts(
  db: Database,
  artworkIds: readonly string[],
): Promise<Map<string, EditionFramingFacts>> {
  const result = new Map<string, EditionFramingFacts>();
  if (artworkIds.length === 0) return result;
  const [artworks, settings, offers] = await Promise.all([
    db
      .select({ id: shopArtwork.id, printSize: shopArtwork.printSize })
      .from(shopArtwork)
      .where(inArray(shopArtwork.id, [...artworkIds])),
    db
      .select()
      .from(shopEditionFraming)
      .where(inArray(shopEditionFraming.artworkId, [...artworkIds])),
    db
      .select()
      .from(shopFramingEditionOffer)
      .where(inArray(shopFramingEditionOffer.artworkId, [...artworkIds])),
  ]);
  const optionIds = [...new Set(offers.map((offer) => offer.optionId))];
  const optionRows =
    optionIds.length === 0
      ? []
      : await db.select().from(shopFramingOption).where(inArray(shopFramingOption.id, optionIds));
  const options = await optionFacts(db, optionRows);
  const settingsByArtwork = new Map(settings.map((row) => [row.artworkId, row]));

  for (const artwork of artworks) {
    const saved = settingsByArtwork.get(artwork.id);
    const forArtwork: EditionFramingOfferFacts[] = [];
    for (const offer of offers) {
      if (offer.artworkId !== artwork.id) continue;
      const option = options.get(offer.optionId);
      if (option) forArtwork.push({ ...option, overridePence: offer.priceOverridePence });
    }
    result.set(artwork.id, {
      artworkId: artwork.id,
      mode: (saved?.mode as FramingMode | undefined) ?? "unframed_or_framed",
      framedByArtist: saved?.framedByArtist ?? "",
      sheetSize: artwork.printSize,
      offers: forArtwork,
      settingsUpdatedAt: saved?.updatedAt ?? null,
    });
  }
  return result;
}

/** Reads framing facts for editions, for the buyer's page and the basket. */
export function createDrizzleEditionFramingReader(db: Database): EditionFramingReader {
  return {
    read: (artworkIds) => readFacts(db, artworkIds),
    readBySlug: async (slug) => {
      const [artwork] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(and(eq(shopArtwork.slug, slug), publicArtworkVisible()))
        .limit(1);
      return artwork ? ((await readFacts(db, [artwork.id])).get(artwork.id) ?? null) : null;
    },
    options: async (optionIds) => {
      if (optionIds.length === 0) return new Map();
      const rows = await db
        .select()
        .from(shopFramingOption)
        .where(inArray(shopFramingOption.id, [...optionIds]));
      return optionFacts(db, rows);
    },
  };
}

/** An edition's framing reads and writes on one transaction's connection. */
export function createDrizzleEditionFramingStore(db: Database): EditionFramingStore {
  return {
    async lockEdition(artworkId) {
      const [row] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId))
        .for("update")
        .limit(1);
      return row !== undefined;
    },

    async facts(artworkId) {
      const facts = (await readFacts(db, [artworkId])).get(artworkId);
      if (!facts) throw new Error(`Artwork ${artworkId} has no framing facts`);
      return facts;
    },

    async catalogue() {
      const rows = await db
        .select()
        .from(shopFramingOption)
        .orderBy(asc(shopFramingOption.sortOrder), asc(shopFramingOption.createdAt));
      const facts = await optionFacts(db, rows);
      return rows.flatMap((row) => {
        const option = facts.get(row.id);
        return option ? [option] : [];
      });
    },

    async replace(input) {
      const now = new Date();
      await db
        .insert(shopEditionFraming)
        .values({
          artworkId: input.artworkId,
          mode: input.mode,
          framedByArtist: input.framedByArtist,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: shopEditionFraming.artworkId,
          set: { mode: input.mode, framedByArtist: input.framedByArtist, updatedAt: now },
        });
      await db
        .delete(shopFramingEditionOffer)
        .where(eq(shopFramingEditionOffer.artworkId, input.artworkId));
      if (input.offers.length > 0) {
        await db.insert(shopFramingEditionOffer).values(
          input.offers.map((offer) => ({
            optionId: offer.optionId,
            artworkId: input.artworkId,
            priceOverridePence: offer.overridePence,
          })),
        );
      }
    },
  };
}
