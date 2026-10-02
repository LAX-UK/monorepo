import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopParty, shopSaleAuthorityGrant } from "@auction/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import type {
  GrantSaleAuthorityCommand,
  GrantSaleAuthorityResult,
} from "../../application/ports/sale-authority.writer.js";

export const SHOP_SEED_IMPORT_KEYS = {
  eligible: "seed:shop:foundation:eligible-artwork",
  ineligible: "seed:shop:foundation:ineligible-artwork",
  secondEligible: "seed:shop:foundation:second-eligible-artwork",
  buyerFixture: "seed:shop:foundation:buyer-fixture-artwork",
} as const;

/** Slug with sellable print editions after foundation seed (not depleted). */
export const SHOP_SEED_BUYER_FIXTURE_SLUG = "harbor-print";

/** Dedicated Stripe checkout acceptance fixture (reset between staging runs). */
export const SHOP_SEED_STRIPE_CHECKOUT_SLUG = "acceptance-stripe-print";

async function depleteEditionStockForSlug(db: Database, slug: string): Promise<void> {
  const artwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, slug))
    .limit(1);
  const artworkId = artwork[0]?.id;
  if (!artworkId) return;
  const [alreadySold] = await db
    .select({ id: shopEdition.id })
    .from(shopEdition)
    .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "sold")))
    .limit(1);
  if (alreadySold) return;
  await db
    .update(shopEdition)
    .set({ listingStatus: "sold", ownerPartyId: null })
    .where(eq(shopEdition.artworkId, artworkId));
}

async function grantSeedAuthorityForArtwork(
  db: Database,
  grantSaleAuthority: (command: GrantSaleAuthorityCommand) => Promise<GrantSaleAuthorityResult>,
  artworkId: string,
): Promise<void> {
  const owners = await db
    .select({
      ownerPartyId: shopEdition.ownerPartyId,
      eligibleCount: sql<number>`count(*) filter (where "shop_edition"."listing_status" <> 'sold')::int`,
    })
    .from(shopEdition)
    .innerJoin(shopParty, eq(shopParty.id, shopEdition.ownerPartyId))
    .where(
      and(
        eq(shopEdition.artworkId, artworkId),
        isNotNull(shopEdition.ownerPartyId),
        eq(shopParty.kind, "lax"),
      ),
    )
    .groupBy(shopEdition.ownerPartyId);

  for (const row of owners) {
    if (!row.ownerPartyId || row.eligibleCount <= 0) continue;
    const [existingGrant] = await db
      .select({ id: shopSaleAuthorityGrant.id })
      .from(shopSaleAuthorityGrant)
      .where(
        and(
          eq(shopSaleAuthorityGrant.artworkId, artworkId),
          eq(shopSaleAuthorityGrant.ownerPartyId, row.ownerPartyId),
        ),
      )
      .limit(1);
    if (existingGrant) continue;
    await grantSaleAuthority({
      artworkId,
      ownerPartyId: row.ownerPartyId,
      authorisedCount: Math.min(Number(row.eligibleCount), 10),
      recordedBySubjectId: "seed:catalogue",
      evidenceNote: "Foundation catalogue seed explicit grant",
    });
  }
}

export async function seedShopFoundationCatalogue(
  importArtwork: ImportArtworkHandler,
  db?: Database,
  grantSaleAuthority?: (command: GrantSaleAuthorityCommand) => Promise<GrantSaleAuthorityResult>,
): Promise<void> {
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.eligible,
    slug: "vessel-study",
    title: "Vessel Study",
    description: "An expressive still life built from a dark vessel and intersecting colour.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "price_on_application",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.ineligible,
    slug: "string-study",
    title: "String Study",
    description: "A suspended stringed instrument set against layered, muted colour.",
    primaryImageUrl: "/shop/home/original-2.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "price_on_application",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: false,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.buyerFixture,
    slug: SHOP_SEED_BUYER_FIXTURE_SLUG,
    title: "Harbor Print",
    description: "A coastal print edition kept in stock for commerce acceptance fixtures.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "60 × 45 cm",
    yearCreated: 2016,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 8_500,
  });
  await importArtwork({
    importKey: "seed:shop:foundation:stripe-checkout-artwork",
    slug: SHOP_SEED_STRIPE_CHECKOUT_SLUG,
    title: "Acceptance Stripe Print",
    description: "Isolated print stock for staging Stripe checkout acceptance.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "50 × 40 cm",
    yearCreated: 2018,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 4_200,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.secondEligible,
    slug: "reed-study",
    title: "Reed Study",
    description: "A rhythmic study of panpipes and angular fields of colour.",
    primaryImageUrl: "/shop/home/original-3.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 9_500,
  });
  if (db && grantSaleAuthority) {
    for (const slug of [
      "vessel-study",
      SHOP_SEED_BUYER_FIXTURE_SLUG,
      SHOP_SEED_STRIPE_CHECKOUT_SLUG,
      "reed-study",
    ]) {
      const row = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, slug))
        .limit(1);
      if (row[0]) {
        await grantSeedAuthorityForArtwork(db, grantSaleAuthority, row[0].id);
      }
    }
    await depleteEditionStockForSlug(db, "reed-study");
  }
}
