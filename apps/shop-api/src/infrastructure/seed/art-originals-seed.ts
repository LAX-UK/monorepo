import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopHomePlacement } from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
import { inArray } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import type { ImportArtworkCommand } from "../../application/ports/artwork-import.writer.js";

type ArtSeedArtist = Pick<
  ImportArtworkCommand,
  "artistSlug" | "artistDisplayName" | "artistDiscipline" | "artistPortraitUrl"
>;

type ArtSeedDetails = {
  objectType: NonNullable<(typeof shopArtwork.$inferInsert)["objectType"]>;
  rarity: NonNullable<(typeof shopArtwork.$inferInsert)["rarity"]>;
  heightCm: number;
  widthCm: number;
  depthCm?: number;
  hasCertificate: boolean;
  provenance?: string;
  exhibitionHistory?: string;
};

type ArtSeedOriginal = Omit<
  ImportArtworkCommand,
  keyof ArtSeedArtist | "importKey" | "eligibleForEditionAllocation" | "saleState"
> & { artist: ArtSeedArtist; details: ArtSeedDetails };

const MARA: ArtSeedArtist = {
  artistSlug: "art-foundation-artist",
  artistDisplayName: "Mara Ellison",
  artistDiscipline: "Painter",
  artistPortraitUrl: "/art/seed/artist-juno.webp",
};
const THEO: ArtSeedArtist = {
  artistSlug: "theo-marsh",
  artistDisplayName: "Theo Marsh",
  artistDiscipline: "Sculptor",
  artistPortraitUrl: "/art/seed/artist-elias.webp",
};
const INES: ArtSeedArtist = {
  artistSlug: "ines-okafor",
  artistDisplayName: "Ines Okafor",
  artistDiscipline: "Photographer",
  artistPortraitUrl: "/art/seed/artist-emmett.webp",
};
const ROWAN: ArtSeedArtist = {
  artistSlug: "rowan-hale",
  artistDisplayName: "Rowan Hale",
  artistDiscipline: "Printmaker",
  artistPortraitUrl: null,
};

const GALLERY_PROVENANCE = "Acquired directly from the artist's studio by London Art Exchange.";

/**
 * lax.art originals across every medium so tiles, related rails and filters have data.
 * Root-relative `/art/seed/*` images are served by `apps/art/public`, so they resolve only on Art.
 */
const ART_SEED_ORIGINALS: readonly ArtSeedOriginal[] = [
  {
    slug: "tidal-forms",
    title: "Tidal Forms",
    description: "Layered blues and ochres tracing the movement of a receding tide.",
    primaryImageUrl: "/art/seed/original-2.webp",
    dimensions: "100 × 80 cm",
    medium: "Oil on canvas",
    yearCreated: 2021,
    artist: MARA,
    details: {
      objectType: "painting",
      rarity: "unique",
      heightCm: 100,
      widthCm: 80,
      hasCertificate: true,
      provenance: GALLERY_PROVENANCE,
      exhibitionHistory: "New Originals, LAX Marylebone, 2026.",
    },
  },
  {
    slug: "quiet-orchard",
    title: "Quiet Orchard",
    description: "A muted orchard study in graphite and wash.",
    primaryImageUrl: "/art/seed/original-3.webp",
    dimensions: "70 × 50 cm",
    medium: "Graphite and watercolour on paper",
    yearCreated: 2019,
    artist: MARA,
    details: {
      objectType: "work_on_paper",
      rarity: "unique",
      heightCm: 70,
      widthCm: 50,
      hasCertificate: true,
      provenance: GALLERY_PROVENANCE,
    },
  },
  {
    slug: "harbour-light",
    title: "Harbour Light",
    description: "Evening light breaking across a working harbour, built up in thin glazes.",
    primaryImageUrl: "/art/seed/hero-layer-1.webp",
    dimensions: "60 × 60 cm",
    medium: "Oil on linen",
    yearCreated: 2023,
    artist: MARA,
    details: {
      objectType: "painting",
      rarity: "unique",
      heightCm: 60,
      widthCm: 60,
      hasCertificate: true,
    },
  },
  {
    slug: "bronze-tide",
    title: "Bronze Tide",
    description: "A cast bronze form that folds like a breaking wave.",
    primaryImageUrl: "/art/seed/hero-layer-2.webp",
    dimensions: "45 × 30 × 25 cm",
    medium: "Patinated bronze",
    yearCreated: 2022,
    artist: THEO,
    details: {
      objectType: "sculpture",
      rarity: "limited_edition",
      heightCm: 45,
      widthCm: 30,
      depthCm: 25,
      hasCertificate: true,
      provenance: GALLERY_PROVENANCE,
      exhibitionHistory: "Form & Fold, LAX Marylebone, 2025.",
    },
  },
  {
    slug: "vessel-form-ii",
    title: "Vessel Form II",
    description: "Hand-built stoneware with an ash glaze, the second in a series of vessels.",
    primaryImageUrl: "/art/seed/artwork-warm-basket.webp",
    dimensions: "38 × 22 × 22 cm",
    medium: "Glazed stoneware",
    yearCreated: 2024,
    artist: THEO,
    details: {
      objectType: "sculpture",
      rarity: "unique",
      heightCm: 38,
      widthCm: 22,
      depthCm: 22,
      hasCertificate: false,
    },
  },
  {
    slug: "marylebone-dusk",
    title: "Marylebone Dusk",
    description: "A long exposure of the high street as the shops close.",
    primaryImageUrl: "/art/seed/hero-layer-3.webp",
    dimensions: "80 × 120 cm",
    medium: "Archival pigment print",
    yearCreated: 2024,
    artist: INES,
    details: {
      objectType: "photography",
      rarity: "limited_edition",
      heightCm: 80,
      widthCm: 120,
      hasCertificate: true,
    },
  },
  {
    slug: "still-water",
    title: "Still Water",
    description: "A reservoir at first light, printed on a matte cotton rag.",
    primaryImageUrl: "/art/seed/signup-gallery.webp",
    dimensions: "50 × 70 cm",
    medium: "Archival pigment print",
    yearCreated: 2022,
    artist: INES,
    details: {
      objectType: "photography",
      rarity: "limited_edition",
      heightCm: 50,
      widthCm: 70,
      hasCertificate: true,
    },
  },
  {
    slug: "field-notes",
    title: "Field Notes",
    description: "A three-plate etching of hedgerow studies, hand-inked by the artist.",
    primaryImageUrl: "/art/seed/original-3.webp",
    dimensions: "40 × 50 cm",
    medium: "Etching and aquatint",
    yearCreated: 2020,
    artist: ROWAN,
    details: {
      objectType: "print",
      rarity: "limited_edition",
      heightCm: 40,
      widthCm: 50,
      hasCertificate: false,
    },
  },
];

export const ART_SEED_ORIGINAL_SLUGS = ART_SEED_ORIGINALS.map((item) => item.slug);

/** Artists curated into Art's featured strip; positions follow Shop's seeded artists. */
const ART_FEATURED_ARTIST_SLUGS = [MARA, THEO, INES].map((artist) => artist.artistSlug);
const ART_FEATURED_FIRST_POSITION = 3;

function toNumeric(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(2);
}

async function seedArtFeaturedArtists(db: Database): Promise<void> {
  const artists = await db
    .select({ id: shopArtist.id, slug: shopArtist.slug })
    .from(shopArtist)
    .where(inArray(shopArtist.slug, ART_FEATURED_ARTIST_SLUGS));
  const idBySlug = new Map(artists.map((row) => [row.slug, row.id]));
  const max = maxItemsForPlacement("featured_artists");
  const publishedAt = new Date();
  for (const [index, slug] of ART_FEATURED_ARTIST_SLUGS.entries()) {
    const position = ART_FEATURED_FIRST_POSITION + index;
    const artistId = idBySlug.get(slug);
    if (!artistId || position >= max) continue;
    await db
      .insert(shopHomePlacement)
      .values({ slot: "featured_artists", position, artistId, publishedAt })
      .onConflictDoNothing();
  }
}

/** Idempotent: re-import keeps slugs stable and rewrites the structured specs. */
export async function seedArtChannelOriginals(
  importArtwork: ImportArtworkHandler,
  db: Database,
): Promise<void> {
  for (const { artist, details, ...work } of ART_SEED_ORIGINALS) {
    await importArtwork({
      ...work,
      ...artist,
      importKey: `seed:art:foundation:${work.slug}`,
      saleState: "price_on_application",
      eligibleForEditionAllocation: false,
    });
    await db
      .update(shopArtwork)
      .set({
        salesChannel: "art",
        objectType: details.objectType,
        rarity: details.rarity,
        heightCm: toNumeric(details.heightCm),
        widthCm: toNumeric(details.widthCm),
        depthCm: toNumeric(details.depthCm),
        hasCertificate: details.hasCertificate,
        provenance: details.provenance ?? null,
        exhibitionHistory: details.exhibitionHistory ?? null,
      })
      .where(inArray(shopArtwork.slug, [work.slug]));
  }
  await seedArtFeaturedArtists(db);
}
