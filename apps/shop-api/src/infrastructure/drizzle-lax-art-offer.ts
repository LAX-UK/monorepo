import { randomUUID } from "node:crypto";
import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopArtworkImage, shopParty } from "@auction/db/schema";
import type { AdminLaxArtListing } from "@auction/shop-contracts";
import { and, eq, isNull, ne } from "drizzle-orm";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import { laxArtOfferBlockers } from "../application/artwork-register/lax-art-offer-blockers.js";
import type {
  CreateLaxArtDraftCommand,
  CreatedLaxArtDraft,
  LaxArtArtistDirectory,
  LaxArtDraftWriter,
  LaxArtListingReader,
} from "../application/ports/offer-on-lax-art.ports.js";
import {
  LaxArtArtistRefusedError,
  LaxArtOfferRefusedError,
} from "../application/ports/offer-on-lax-art.ports.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import { withCatalogueSlugConflict } from "./catalogue-unique-violation.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

const CAPABILITY = "catalogue.write";
const ZOHO_PRODUCT_INDEX = "shop_artwork_zoho_product_uid";
const IMPORT_KEY_INDEX = "shop_artwork_import_key_uid";
// Both indexes describe the same draft (its register record), so either one names the race.
const SAME_DRAFT_INDEXES: ReadonlySet<string | null> = new Set([
  ZOHO_PRODUCT_INDEX,
  IMPORT_KEY_INDEX,
]);

export function createDrizzleLaxArtArtistDirectory(db: Database): LaxArtArtistDirectory {
  return {
    async findByZohoArtistCode(code) {
      const [row] = await db
        .select({
          artistId: shopArtist.id,
          displayName: shopParty.displayName,
          archivedAt: shopArtist.archivedAt,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.zohoArtistCode, code))
        .limit(1);
      return row
        ? {
            artistId: row.artistId,
            displayName: row.displayName,
            archived: row.archivedAt !== null,
          }
        : null;
    },
  };
}

function toListing(row: {
  id: string;
  slug: string;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}): AdminLaxArtListing {
  return {
    artworkId: row.id,
    slug: row.slug,
    published: row.publishedAt !== null && row.archivedAt === null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createDrizzleLaxArtListingReader(db: Database): LaxArtListingReader {
  return {
    async findByZohoProductId(zohoProductId) {
      const [row] = await db
        .select({
          id: shopArtwork.id,
          slug: shopArtwork.slug,
          publishedAt: shopArtwork.publishedAt,
          archivedAt: shopArtwork.archivedAt,
          createdAt: shopArtwork.createdAt,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.zohoProductId, zohoProductId))
        .limit(1);
      return row ? toListing(row) : null;
    },
    async findZohoProductId(artworkId) {
      const [row] = await db
        .select({ zohoProductId: shopArtwork.zohoProductId })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId))
        .limit(1);
      return row?.zohoProductId ?? null;
    },
  };
}

/** The register, as far as making a draft needs it, bound to the transaction the draft is made in. */
export type DraftRegister = {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
  recordLaxArtDraftCreated(input: {
    registerId: string;
    actor: string;
    artworkId: string;
    now: Date;
  }): Promise<void>;
};

/**
 * Saves Zoho's artist code on the chosen artist when it has none; an artist that already carries
 * a different code, or another artist that carries this one, is refused, so a code never moves.
 */
async function claimArtistCode(
  session: Database,
  artistId: string,
  entry: ArtworkRegisterEntry,
): Promise<void> {
  const code = entry.artist.code;
  const [artist] = await session
    .select({
      id: shopArtist.id,
      zohoArtistCode: shopArtist.zohoArtistCode,
      archivedAt: shopArtist.archivedAt,
    })
    .from(shopArtist)
    .where(eq(shopArtist.id, artistId))
    .limit(1);
  if (!artist) throw new LaxArtArtistRefusedError("Choose an existing lax.art artist.");
  if (artist.archivedAt) {
    throw new LaxArtArtistRefusedError("That artist is archived. Restore the artist first.");
  }
  if (artist.zohoArtistCode === code) return;
  if (artist.zohoArtistCode !== null) {
    throw new LaxArtArtistRefusedError(
      `That artist already uses Zoho artist code ${artist.zohoArtistCode}. Choose the artist for ${entry.artist.name}.`,
    );
  }
  const [holder] = await session
    .select({ id: shopArtist.id })
    .from(shopArtist)
    .where(and(eq(shopArtist.zohoArtistCode, code), ne(shopArtist.id, artistId)))
    .limit(1);
  if (holder) {
    throw new LaxArtArtistRefusedError(
      `Zoho artist code ${code} belongs to another lax.art artist. Choose that artist.`,
    );
  }
  await session
    .update(shopArtist)
    .set({ zohoArtistCode: code })
    .where(and(eq(shopArtist.id, artistId), isNull(shopArtist.zohoArtistCode)));
}

/**
 * Makes the lax.art draft from a register entry in one transaction. The draft starts with Zoho's
 * title, medium, size, year and images; description and search listing are written on the artwork
 * page. It is not published, so nothing a buyer sees changes and the register still says the
 * artwork is not offered: publishing is what records it on lax.art, and that is where the lock
 * decides. The draft is still checked here so a record held elsewhere never gets a second listing.
 */
export function createDrizzleLaxArtDraftWriter(
  uow: ShopUnitOfWorkFactory,
  options: {
    registerFor: (session: Database) => DraftRegister;
    listings: LaxArtListingReader;
    now?: () => Date;
  },
): LaxArtDraftWriter {
  const { registerFor, listings } = options;
  const clock = options.now ?? (() => new Date());

  async function existingDraft(zohoProductId: string): Promise<CreatedLaxArtDraft | null> {
    const found = await listings.findByZohoProductId(zohoProductId);
    return found ? { artworkId: found.artworkId, slug: found.slug, created: false } : null;
  }

  async function create(command: CreateLaxArtDraftCommand): Promise<CreatedLaxArtDraft> {
    const { entry } = command;
    return uow.run((tx) =>
      withAdminIdempotency({
        tx,
        commandType: "artwork.offer_on_lax_art",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: {
          registerId: entry.id,
          artistId: command.artistId,
          saleState: command.saleState,
          slug: command.slug,
        },
        run: async (): Promise<CreatedLaxArtDraft> => {
          const session = shopPhaseDbSession(tx);
          const register = registerFor(session);
          const [held] = await session
            .select({ id: shopArtwork.id, slug: shopArtwork.slug })
            .from(shopArtwork)
            .where(eq(shopArtwork.zohoProductId, entry.zohoProductId))
            .limit(1);
          if (held) return { artworkId: held.id, slug: held.slug, created: false };

          const fresh = await register.findById(entry.id);
          if (!fresh) throw new LaxArtOfferRefusedError([]);
          const artworkId = randomUUID();
          const blockers = laxArtOfferBlockers(fresh, { kind: "shop_artwork", id: artworkId });
          if (blockers.length > 0) throw new LaxArtOfferRefusedError(blockers);
          await claimArtistCode(session, command.artistId, fresh);

          const importKey = `register:${fresh.id}`;
          const imageKeys = [...new Set(fresh.imageRefs)];
          const [artwork] = await withCatalogueSlugConflict(() =>
            session
              .insert(shopArtwork)
              .values({
                id: artworkId,
                slug: command.slug,
                title: fresh.title,
                artistId: command.artistId,
                yearCreated: fresh.year,
                medium: fresh.medium,
                dimensions: fresh.dimensions,
                eligibleForEditionAllocation: false,
                saleState: command.saleState,
                salesChannel: "art",
                zohoProductId: fresh.zohoProductId,
                importKey,
                // A draft: nothing is public until staff publish it from the artwork page.
                publishedAt: null,
              })
              .returning(),
          );
          if (!artwork) throw new Error("The lax.art draft was not saved");
          if (imageKeys.length > 0) {
            await session.insert(shopArtworkImage).values(
              imageKeys.map((mediaKey, position) => ({
                artworkId,
                mediaKey,
                position,
                alt: null,
              })),
            );
          }
          const actor = `staff:${command.actorSubjectId}`;
          await tx.events.append({
            aggregateType: "shop_artwork",
            aggregateId: artworkId,
            eventType: "shop.artwork.created",
            payload: {
              schemaVersion: 1,
              importKey,
              slug: artwork.slug,
              eligibleForEditionAllocation: false,
            },
          });
          await register.recordLaxArtDraftCreated({
            registerId: fresh.id,
            actor,
            artworkId,
            now: clock(),
          });
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: CAPABILITY,
            action: "offer_on_lax_art",
            targetType: "shop_artwork",
            targetId: artworkId,
            afterJson: {
              registerId: fresh.id,
              stockCode: fresh.stockCode,
              artistId: command.artistId,
              saleState: command.saleState,
              slug: artwork.slug,
              images: imageKeys,
            },
          });
          return { artworkId, slug: artwork.slug, created: true };
        },
      }),
    );
  }

  return {
    async createDraft(command) {
      try {
        return await create(command);
      } catch (error) {
        // Two people (or two clicks) made the draft at once: the loser's insert hit a unique
        // index, and the winner's draft is the one both of them get.
        if (SAME_DRAFT_INDEXES.has(pgUniqueViolationConstraint(error))) {
          const winner = await existingDraft(command.entry.zohoProductId);
          if (winner) return winner;
        }
        throw error;
      }
    },
  };
}
