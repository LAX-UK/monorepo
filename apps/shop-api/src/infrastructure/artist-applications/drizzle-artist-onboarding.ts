import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopMediaAsset,
  shopParty,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ArtistApplicationWorkKind } from "@auction/shop-domain";
import { and, eq, inArray, like } from "drizzle-orm";
import type { ArtistOnboarding } from "../../application/artist-applications/artist-application.ports.js";
import type { ShopTransactionEffects } from "../../application/ports/shop-unit-of-work.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { withCatalogueSlugConflict } from "../catalogue-unique-violation.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { linkArtistIdentityInTx } from "../link-artist-identity.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

const CAPABILITY = "artist_application.review";

/** How an applicant's work lands in the catalogue: originals on lax.art, editions in Shop. */
const WORK_KIND_CATALOGUE: Record<
  ArtistApplicationWorkKind,
  { salesChannel: "art" | "shop"; rarity: "unique" | "limited_edition" }
> = {
  original: { salesChannel: "art", rarity: "unique" },
  edition: { salesChannel: "shop", rarity: "limited_edition" },
};

/** Lower-case words joined by hyphens, as catalogue addresses are written. */
export function slugifyTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** The first of `base`, `base-2`, `base-3`… that no artwork and no earlier pick uses. */
function freeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Makes an accepted applicant a gallery artist inside the review transaction. The profile is a
 * party plus an artist row, as staff create artists by hand; portal access is the same link staff
 * make with "Link by email"; imported works are drafts, so nothing is public until staff publish.
 */
export function createDrizzleArtistOnboarding(
  tx: ShopTransactionEffects,
  options: { resolveMediaUrl: ResolveMediaUrl },
): ArtistOnboarding {
  const session = shopPhaseDbSession(tx);

  return {
    async createArtistProfile(input) {
      const [party] = await session
        .insert(shopParty)
        .values({ displayName: input.displayName })
        .returning({ id: shopParty.id });
      if (!party) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create artist", 500);
      }
      const [artist] = await withCatalogueSlugConflict(() =>
        session
          .insert(shopArtist)
          .values({
            partyId: party.id,
            slug: input.slug,
            shortBio: input.shortBio,
            bio: input.bio,
          })
          .returning({ id: shopArtist.id, slug: shopArtist.slug }),
      );
      if (!artist) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create artist", 500);
      }
      await tx.audit.append({
        actorSubjectId: input.actorSubjectId,
        capability: CAPABILITY,
        action: "create_artist",
        targetType: "shop_artist",
        targetId: artist.id,
        afterJson: {
          displayName: input.displayName,
          slug: artist.slug,
          fromApplicationId: input.applicationId,
        },
      });
      return { artistId: artist.id, slug: artist.slug };
    },

    async grantPortalAccess(input) {
      await linkArtistIdentityInTx(tx, {
        artistId: input.artistId,
        identitySubjectId: input.identitySubjectId,
        actorSubjectId: input.actorSubjectId,
        capability: CAPABILITY,
        auditContext: { fromApplicationId: input.applicationId },
      });
    },

    async importDraftArtworks(input) {
      if (input.works.length === 0) return 0;
      const keys = input.works.map((work) => work.mediaKey);
      // From now on these are catalogue images, edited and published like any other.
      await session
        .update(shopMediaAsset)
        .set({ kind: "artwork_image", updatedAt: new Date() })
        .where(and(inArray(shopMediaAsset.key, keys), eq(shopMediaAsset.status, "active")));

      const existing = await session
        .select({ slug: shopArtwork.slug })
        .from(shopArtwork)
        .where(like(shopArtwork.slug, `${input.artistSlug}-%`));
      const taken = new Set(existing.map((row) => row.slug));

      for (const [position, work] of input.works.entries()) {
        const title = work.title?.trim() || `Untitled ${position + 1}`;
        const slug = freeSlug(
          `${input.artistSlug}-${slugifyTitle(title) || `work-${position + 1}`}`,
          taken,
        );
        taken.add(slug);
        const placement = WORK_KIND_CATALOGUE[work.kind ?? "original"];
        const importKey = `artist-application:${input.applicationId}:${position}`;
        const [artwork] = await withCatalogueSlugConflict(() =>
          session
            .insert(shopArtwork)
            .values({
              slug,
              title,
              artistId: input.artistId,
              yearCreated: work.year,
              medium: work.medium,
              dimensions: work.size,
              rarity: placement.rarity,
              salesChannel: placement.salesChannel,
              saleState: "price_on_application",
              eligibleForEditionAllocation: false,
              primaryImageUrl: options.resolveMediaUrl(work.mediaKey),
              importKey,
              // Drafts: staff set prices and publish each one when it is ready.
              publishedAt: null,
            })
            .returning({ id: shopArtwork.id }),
        );
        if (!artwork) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to import a work", 500);
        }
        await session
          .insert(shopArtworkImage)
          .values({ artworkId: artwork.id, mediaKey: work.mediaKey, position: 0, alt: title });
        await tx.events.append({
          aggregateType: "shop_artwork",
          aggregateId: artwork.id,
          eventType: "shop.artwork.created",
          payload: { schemaVersion: 1, importKey, slug, eligibleForEditionAllocation: false },
        });
        await tx.audit.append({
          actorSubjectId: input.actorSubjectId,
          capability: CAPABILITY,
          action: "create_artwork",
          targetType: "shop_artwork",
          targetId: artwork.id,
          afterJson: { slug, title, draft: true, fromApplicationId: input.applicationId },
        });
      }
      return input.works.length;
    },
  };
}
