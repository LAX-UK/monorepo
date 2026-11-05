import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type ArtworkRegisterEntry,
  parseStockCode,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  artworkRegister,
  artworkRegisterEvent,
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopCatalogueSetting,
  shopParty,
} from "@auction/db/schema";
import type { IArtworkLinkHistory } from "@auction/persistence/interfaces";
import { registerRowToEntry } from "@auction/persistence/repositories";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { laxArtOfferBlockers } from "../application/artwork-register/lax-art-offer-blockers.js";
import { planLink } from "../application/artwork-register/zoho-link-differences.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import {
  type LinkCommand,
  type LinkWritten,
  type LinkableRecord,
  type UnlinkCommand,
  type UnlinkedListing,
  type ZohoLinkListingReader,
  type ZohoLinkRecordReader,
  ZohoLinkRefusedError,
  type ZohoLinkSettingsStore,
  type ZohoLinkWriter,
} from "../application/ports/zoho-link.ports.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

const ZOHO_PRODUCT_INDEX = "shop_artwork_zoho_product_uid";
const BLOCK_SETTING_KEY = "block_unlinked_publish";

/** Original on lax.art: art channel, not a print run, not an edition artwork, still in the catalogue. */
const unlinkedOriginal = and(
  isNull(shopArtwork.zohoProductId),
  eq(shopArtwork.salesChannel, "art"),
  isNull(shopArtwork.runKind),
  eq(shopArtwork.eligibleForEditionAllocation, false),
  isNull(shopArtwork.archivedAt),
);

const listingColumns = {
  artworkId: shopArtwork.id,
  slug: shopArtwork.slug,
  title: shopArtwork.title,
  medium: shopArtwork.medium,
  dimensions: shopArtwork.dimensions,
  year: shopArtwork.yearCreated,
  publishedAt: shopArtwork.publishedAt,
  importKey: shopArtwork.importKey,
  artistId: shopArtwork.artistId,
  artistName: shopParty.displayName,
  artistCode: shopArtist.zohoArtistCode,
};

type ListingRow = {
  artworkId: string;
  slug: string;
  title: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  publishedAt: Date | null;
  importKey: string;
  artistId: string;
  artistName: string;
  artistCode: string | null;
};

/**
 * The stock code a legacy listing carries. Shop has no stock-code column: a listing "has" one only
 * when its import key is itself a LAX stock code.
 */
export function stockCodeOf(importKey: string): string | null {
  return parseStockCode(importKey.trim().toUpperCase()) ? importKey.trim().toUpperCase() : null;
}

function toListing(row: ListingRow, imageKeys: readonly string[]): UnlinkedListing {
  return {
    artworkId: row.artworkId,
    slug: row.slug,
    title: row.title,
    artistId: row.artistId,
    artistName: row.artistName,
    artistCode: row.artistCode,
    stockCode: stockCodeOf(row.importKey),
    medium: row.medium,
    dimensions: row.dimensions,
    year: row.year,
    imageKeys,
    published: row.publishedAt !== null,
  };
}

async function imagesByArtwork(
  db: Database,
  artworkIds: readonly string[],
): Promise<Map<string, string[]>> {
  const keys = new Map<string, string[]>();
  if (artworkIds.length === 0) return keys;
  const rows = await db
    .select({ artworkId: shopArtworkImage.artworkId, mediaKey: shopArtworkImage.mediaKey })
    .from(shopArtworkImage)
    .where(inArray(shopArtworkImage.artworkId, [...artworkIds]))
    .orderBy(shopArtworkImage.artworkId, shopArtworkImage.position);
  for (const row of rows)
    keys.set(row.artworkId, [...(keys.get(row.artworkId) ?? []), row.mediaKey]);
  return keys;
}

export function createDrizzleZohoLinkListingReader(db: Database): ZohoLinkListingReader {
  const base = () =>
    db
      .select(listingColumns)
      .from(shopArtwork)
      .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id));
  return {
    async listLinked() {
      // The latest "linked" entry in each record's history says who made the link and when.
      const latest = db
        .selectDistinctOn([artworkRegisterEvent.registerId], {
          registerId: artworkRegisterEvent.registerId,
          actor: artworkRegisterEvent.actor,
          linkedAt: artworkRegisterEvent.createdAt,
        })
        .from(artworkRegisterEvent)
        .where(eq(artworkRegisterEvent.type, "zoho_link_linked"))
        .orderBy(artworkRegisterEvent.registerId, desc(artworkRegisterEvent.createdAt))
        .as("latest_link");
      const rows = await db
        .select({
          artworkId: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
          artistName: shopParty.displayName,
          publishedAt: shopArtwork.publishedAt,
          registerId: artworkRegister.id,
          stockCode: artworkRegister.stockCode,
          recordTitle: artworkRegister.title,
          linkedAt: latest.linkedAt,
          actor: latest.actor,
        })
        .from(shopArtwork)
        .innerJoin(artworkRegister, eq(artworkRegister.zohoProductId, shopArtwork.zohoProductId))
        .innerJoin(latest, eq(latest.registerId, artworkRegister.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            eq(shopArtwork.salesChannel, "art"),
            isNull(shopArtwork.runKind),
            isNull(shopArtwork.archivedAt),
          ),
        )
        .orderBy(desc(latest.linkedAt), asc(shopArtwork.id));
      return rows.map((row) => ({
        artworkId: row.artworkId,
        slug: row.slug,
        title: row.title,
        artistName: row.artistName,
        published: row.publishedAt !== null,
        registerId: row.registerId,
        stockCode: row.stockCode,
        recordTitle: row.recordTitle,
        linkedAt: row.linkedAt,
        actor: row.actor,
      }));
    },
    async listUnlinked() {
      const rows = await base()
        .where(unlinkedOriginal)
        .orderBy(asc(shopArtwork.title), asc(shopArtwork.id));
      const images = await imagesByArtwork(
        db,
        rows.map((row) => row.artworkId),
      );
      return rows.map((row) => toListing(row, images.get(row.artworkId) ?? []));
    },
    async countUnlinked() {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(shopArtwork)
        .where(unlinkedOriginal);
      return row?.total ?? 0;
    },
    async findUnlinked(artworkId) {
      const [row] = await base()
        .where(and(unlinkedOriginal, eq(shopArtwork.id, artworkId)))
        .limit(1);
      if (!row) return null;
      const images = await imagesByArtwork(db, [artworkId]);
      return toListing(row, images.get(artworkId) ?? []);
    },
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const linkableSelect = (db: Database) =>
  db
    .select({ row: artworkRegister, linkedTo: shopArtwork.title })
    .from(artworkRegister)
    .leftJoin(shopArtwork, eq(shopArtwork.zohoProductId, artworkRegister.zohoProductId));

type LinkableRow = { row: typeof artworkRegister.$inferSelect; linkedTo: string | null };

const toLinkable = ({ row, linkedTo }: LinkableRow): LinkableRecord => ({
  entry: registerRowToEntry(row),
  linkedTo,
});

export function createDrizzleZohoLinkRecordReader(db: Database): ZohoLinkRecordReader {
  return {
    async listLinkable() {
      const rows = await linkableSelect(db).where(eq(artworkRegister.kind, "original"));
      return rows.map(toLinkable);
    },
    async findById(registerId) {
      const [found] = await linkableSelect(db)
        .where(and(eq(artworkRegister.id, registerId), eq(artworkRegister.kind, "original")))
        .limit(1);
      return found ? toLinkable(found) : null;
    },
    async search(query, limit) {
      const pattern = `%${escapeLike(query)}%`;
      const rows = await linkableSelect(db)
        .where(
          and(
            eq(artworkRegister.kind, "original"),
            or(
              ilike(artworkRegister.stockCode, pattern),
              ilike(artworkRegister.title, pattern),
              ilike(artworkRegister.artistName, pattern),
              ilike(artworkRegister.artistCode, pattern),
            ),
          ),
        )
        .orderBy(asc(artworkRegister.title), asc(artworkRegister.id))
        .limit(limit);
      return rows.map(toLinkable);
    },
  };
}

/** The register, as far as linking needs it, bound to the transaction the link is made in. */
export type LinkRegister = IArtworkLinkHistory & {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
};

type LinkOptions = {
  registerFor: (session: Database) => LinkRegister;
  lockFor: (session: Database) => ArtworkOfferLock;
  now?: () => Date;
};

/** The register's refusal in the register's words. */
async function lockRefusal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ArtworkOfferedElsewhereError) {
      throw new ZohoLinkRefusedError(error.message, [error.lock]);
    }
    if (error instanceof ArtworkOfferMoveError) throw new ZohoLinkRefusedError(error.message);
    throw error;
  }
}

export function createDrizzleZohoLinkWriter(
  uow: ShopUnitOfWorkFactory,
  options: LinkOptions,
): ZohoLinkWriter {
  const clock = options.now ?? (() => new Date());

  async function lockListing(session: Database, artworkId: string) {
    const [row] = await session
      .select({
        id: shopArtwork.id,
        slug: shopArtwork.slug,
        title: shopArtwork.title,
        medium: shopArtwork.medium,
        dimensions: shopArtwork.dimensions,
        year: shopArtwork.yearCreated,
        artistId: shopArtwork.artistId,
        zohoProductId: shopArtwork.zohoProductId,
        salesChannel: shopArtwork.salesChannel,
        runKind: shopArtwork.runKind,
        eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
        publishedAt: shopArtwork.publishedAt,
        archivedAt: shopArtwork.archivedAt,
      })
      .from(shopArtwork)
      .where(eq(shopArtwork.id, artworkId))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  async function link(command: LinkCommand): Promise<LinkWritten> {
    return uow.run(async (tx) => {
      const session = shopPhaseDbSession(tx);
      const register = options.registerFor(session);
      const lock = options.lockFor(session);
      const listing = await lockListing(session, command.artworkId);
      if (!listing) throw new ZohoLinkRefusedError("That artwork was not found.");
      if (
        listing.salesChannel !== "art" ||
        listing.runKind !== null ||
        listing.eligibleForEditionAllocation ||
        listing.archivedAt !== null
      ) {
        throw new ZohoLinkRefusedError("Only an original on lax.art can be linked to Zoho.");
      }
      const entry = await register.findById(command.registerId);
      if (!entry) throw new ZohoLinkRefusedError("That Zoho record was not found.");
      const live = listing.publishedAt !== null;
      if (listing.zohoProductId === entry.zohoProductId) {
        // Linked already, by an earlier click or another person: nothing changes.
        return { linked: false, nowOnLaxArt: live, replaced: [] };
      }
      if (listing.zohoProductId !== null) {
        throw new ZohoLinkRefusedError(
          "This artwork is already linked to another Zoho record. Remove that link first.",
        );
      }
      const ref = { kind: "shop_artwork" as const, id: listing.id };
      const blockers = laxArtOfferBlockers(entry, ref);
      if (blockers.length > 0) {
        throw new ZohoLinkRefusedError(
          blockers.map((blocker) => blocker.message).join(" "),
          blockers,
        );
      }

      const [artist] = await session
        .select({
          artistId: shopArtist.id,
          displayName: shopParty.displayName,
          archivedAt: shopArtist.archivedAt,
          code: shopArtist.zohoArtistCode,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.id, listing.artistId))
        .limit(1);
      const [forCode] = await session
        .select({
          artistId: shopArtist.id,
          displayName: shopParty.displayName,
          archivedAt: shopArtist.archivedAt,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.zohoArtistCode, entry.artist.code))
        .limit(1);
      const images = (await imagesByArtwork(session, [listing.id])).get(listing.id) ?? [];
      const plan = planLink(
        {
          title: listing.title,
          artistId: listing.artistId,
          artistName: artist?.displayName ?? "",
          artistCode: artist?.code ?? null,
          medium: listing.medium,
          dimensions: listing.dimensions,
          year: listing.year,
          imageKeys: images,
        },
        entry,
        forCode
          ? {
              artistId: forCode.artistId,
              displayName: forCode.displayName,
              archived: forCode.archivedAt !== null,
            }
          : null,
      );
      if (plan.artistRefusal) throw new ZohoLinkRefusedError(plan.artistRefusal);

      const now = clock();
      const { update } = plan;
      if (update.claimArtistCode) {
        await session
          .update(shopArtist)
          .set({ zohoArtistCode: update.claimArtistCode })
          .where(and(eq(shopArtist.id, listing.artistId), isNull(shopArtist.zohoArtistCode)));
      }
      await session
        .update(shopArtwork)
        .set({
          zohoProductId: entry.zohoProductId,
          ...(update.title !== undefined ? { title: update.title } : {}),
          ...(update.medium !== undefined ? { medium: update.medium } : {}),
          ...(update.dimensions !== undefined ? { dimensions: update.dimensions } : {}),
          ...(update.yearCreated !== undefined ? { yearCreated: update.yearCreated } : {}),
          ...(update.artistId !== undefined ? { artistId: update.artistId } : {}),
          version: sql`${shopArtwork.version} + 1`,
          updatedAt: now,
        })
        .where(eq(shopArtwork.id, listing.id));
      if (update.images) {
        await session.delete(shopArtworkImage).where(eq(shopArtworkImage.artworkId, listing.id));
        if (update.images.length > 0) {
          await session.insert(shopArtworkImage).values(
            update.images.map((mediaKey, position) => ({
              artworkId: listing.id,
              mediaKey,
              position,
              alt: null,
            })),
          );
        }
      }

      const actor = `staff:${command.actorSubjectId}`;
      // A live listing is offered on lax.art, so the register says so, through the same lock as a
      // publish; a draft stays where it is until it is published.
      if (live) {
        await lockRefusal(() => lock.offer({ registerId: entry.id }, ref, actor));
      } else {
        await lockRefusal(() => lock.assertCanOffer({ registerId: entry.id }, ref));
      }
      const before = {
        title: listing.title,
        medium: listing.medium,
        dimensions: listing.dimensions,
        year: listing.year,
        artistId: listing.artistId,
        images,
      };
      await register.recordZohoLinked({
        registerId: entry.id,
        actor,
        artworkId: listing.id,
        now,
        detail: {
          slug: listing.slug,
          stockCode: entry.stockCode,
          live,
          replaced: plan.replaced,
          before,
        },
      });
      await tx.audit.append({
        actorSubjectId: command.actorSubjectId,
        capability: "artwork_register.review",
        action: "zoho_link",
        targetType: "shop_artwork",
        targetId: listing.id,
        beforeJson: before,
        afterJson: { registerId: entry.id, stockCode: entry.stockCode, replaced: plan.replaced },
      });
      return { linked: true, nowOnLaxArt: live, replaced: plan.replaced };
    });
  }

  async function unlink(command: UnlinkCommand): Promise<boolean> {
    return uow.run(async (tx) => {
      const session = shopPhaseDbSession(tx);
      const register = options.registerFor(session);
      const lock = options.lockFor(session);
      const listing = await lockListing(session, command.artworkId);
      if (!listing) throw new ZohoLinkRefusedError("That artwork was not found.");
      if (listing.zohoProductId === null) return false;
      const [row] = await session
        .select()
        .from(artworkRegister)
        .where(eq(artworkRegister.zohoProductId, listing.zohoProductId))
        .limit(1);
      const entry = row ? registerRowToEntry(row) : null;
      if (entry?.offer.state === "bid_sale") {
        throw new ZohoLinkRefusedError(
          "This artwork is in a LAX Bid sale. Withdraw the lot there before removing the link.",
        );
      }
      const actor = `staff:${command.actorSubjectId}`;
      const now = clock();
      const ref = { kind: "shop_artwork" as const, id: listing.id };
      if (entry) {
        // The listing no longer holds the artwork's place on lax.art.
        await lockRefusal(() => lock.withdraw({ registerId: entry.id }, ref, actor));
      }
      await session
        .update(shopArtwork)
        .set({ zohoProductId: null, version: sql`${shopArtwork.version} + 1`, updatedAt: now })
        .where(eq(shopArtwork.id, listing.id));
      if (entry) {
        await register.recordZohoUnlinked({
          registerId: entry.id,
          actor,
          artworkId: listing.id,
          now,
          detail: { slug: listing.slug, stockCode: entry.stockCode, reason: command.reason },
        });
      }
      await tx.audit.append({
        actorSubjectId: command.actorSubjectId,
        capability: "artwork_register.unlink",
        action: "zoho_unlink",
        targetType: "shop_artwork",
        targetId: listing.id,
        beforeJson: { zohoProductId: listing.zohoProductId },
        afterJson: { reason: command.reason },
      });
      return true;
    });
  }

  const taken = (error: unknown) => {
    if (pgUniqueViolationConstraint(error) !== ZOHO_PRODUCT_INDEX) return null;
    return new ZohoLinkRefusedError(
      "Another lax.art artwork was linked to this Zoho record a moment ago. Check again.",
    );
  };

  return {
    async link(command) {
      try {
        return await link(command);
      } catch (error) {
        throw taken(error) ?? error;
      }
    },
    unlink,
  };
}

export function createDrizzleZohoLinkSettings(
  db: Database,
  now: () => Date = () => new Date(),
): ZohoLinkSettingsStore {
  return {
    async blockUnlinkedPublish() {
      const [row] = await db
        .select({ enabled: shopCatalogueSetting.enabled })
        .from(shopCatalogueSetting)
        .where(eq(shopCatalogueSetting.key, BLOCK_SETTING_KEY))
        .limit(1);
      return row?.enabled ?? false;
    },
    async setBlockUnlinkedPublish(enabled, actorSubjectId) {
      await db
        .insert(shopCatalogueSetting)
        .values({ key: BLOCK_SETTING_KEY, enabled, updatedAt: now(), updatedBy: actorSubjectId })
        .onConflictDoUpdate({
          target: shopCatalogueSetting.key,
          set: { enabled, updatedAt: now(), updatedBy: actorSubjectId },
        });
    },
  };
}
