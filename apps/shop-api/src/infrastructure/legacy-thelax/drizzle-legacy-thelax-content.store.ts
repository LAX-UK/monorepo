import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEditorialPage,
  shopEditorialStory,
  shopParty,
} from "@auction/db/schema";
import { parseEditorialBlocks } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type { LegacyThelaxContentStore } from "../../application/ports/legacy-thelax-import.ports.js";
import { upsertShopArtist } from "../upsert-shop-artist.js";

/** Columns written only while still empty, so staff edits always win over the import. */
function missingOnly<T extends Record<string, unknown>>(
  current: Record<keyof T, unknown>,
  incoming: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(incoming).filter(
      ([column, value]) => value !== null && (current[column] === null || current[column] === ""),
    ),
  ) as Partial<T>;
}

export function createDrizzleLegacyThelaxContentStore(db: Database): LegacyThelaxContentStore {
  return {
    async findArtworkImportKey(slug) {
      const [row] = await db
        .select({ importKey: shopArtwork.importKey })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, slug))
        .limit(1);
      return row ? row.importKey : undefined;
    },

    async findArtist(slug) {
      const [row] = await db
        .select({
          displayName: shopParty.displayName,
          discipline: shopArtist.discipline,
          portraitImageUrl: shopArtist.portraitImageUrl,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async ensureArtist(input) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: shopArtist.id,
            bio: shopArtist.bio,
            portraitImageUrl: shopArtist.portraitImageUrl,
            seoTitle: shopArtist.seoTitle,
            seoDescription: shopArtist.seoDescription,
          })
          .from(shopArtist)
          .where(eq(shopArtist.slug, input.slug))
          .for("update")
          .limit(1);
        const profile = {
          bio: input.bio,
          portraitImageUrl: input.portraitImageUrl,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
        };
        if (!existing) {
          const artistId = await upsertShopArtist(tx as Database, {
            slug: input.slug,
            displayName: input.displayName,
            discipline: null,
            portraitImageUrl: input.portraitImageUrl,
          });
          await tx.update(shopArtist).set(profile).where(eq(shopArtist.id, artistId));
          return "created";
        }
        const fill = missingOnly(existing, profile);
        if (Object.keys(fill).length === 0) return "unchanged";
        await tx.update(shopArtist).set(fill).where(eq(shopArtist.id, existing.id));
        return "updated";
      });
    },

    async upsertStory(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: shopEditorialStory.id, updatedBy: shopEditorialStory.updatedBy })
          .from(shopEditorialStory)
          .where(eq(shopEditorialStory.slug, input.slug))
          .for("update")
          .limit(1);
        const content = {
          title: input.title,
          standfirst: input.standfirst,
          coverMediaKey: input.coverMediaKey,
          bodyBlocks: body,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          updatedBy: input.actor,
        };
        if (!existing) {
          await tx.insert(shopEditorialStory).values({
            ...content,
            slug: input.slug,
            kind: "article",
            status: "published",
            publishedAt: new Date(),
          });
          return "created";
        }
        if (existing.updatedBy !== input.actor) return "kept_staff_edit";
        await tx
          .update(shopEditorialStory)
          .set({ ...content, updatedAt: new Date() })
          .where(eq(shopEditorialStory.id, existing.id));
        return "updated";
      });
    },

    async upsertPage(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: shopEditorialPage.id, updatedBy: shopEditorialPage.updatedBy })
          .from(shopEditorialPage)
          .where(eq(shopEditorialPage.slug, input.slug))
          .for("update")
          .limit(1);
        const content = {
          title: input.title,
          bodyBlocks: body,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          updatedBy: input.actor,
        };
        if (!existing) {
          await tx.insert(shopEditorialPage).values({
            ...content,
            slug: input.slug,
            status: "published",
            publishedAt: new Date(),
          });
          return "created";
        }
        if (existing.updatedBy !== input.actor) return "kept_staff_edit";
        await tx
          .update(shopEditorialPage)
          .set({ ...content, updatedAt: new Date() })
          .where(eq(shopEditorialPage.id, existing.id));
        return "updated";
      });
    },
  };
}
