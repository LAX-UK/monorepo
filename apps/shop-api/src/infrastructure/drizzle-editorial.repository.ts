import type { Database } from "@auction/db";
import {
  shopEditorialExhibition,
  shopEditorialExhibitionMedia,
  shopEditorialPage,
  shopEditorialPlacement,
  shopEditorialStory,
  shopEditorialVenue,
  shopGeneralEnquiry,
} from "@auction/db/schema";
import {
  type EditorialBlock,
  SHOP_API_ERROR_CODES,
  mapEditorialBlockMedia,
  parseEditorialBlocks,
} from "@auction/shop-contracts";
import { type SQL, and, asc, desc, eq, gt, gte, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import type { EditorialRepository } from "../application/ports/editorial.repository.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";

type RepoOptions = {
  resolveMediaUrl: (value: string | null | undefined) => string | null;
  /** Staff alert queued in the same transaction as each general enquiry. */
  generalEnquiryAlerts?: { notifications: ShopNotificationPublisher; opsEmail: string };
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Drops individual blocks that no longer satisfy the contract instead of blanking the body. */
function readBlocks(value: unknown): EditorialBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block: unknown) => {
    try {
      return parseEditorialBlocks([block]);
    } catch {
      return [];
    }
  });
}

async function refSlugForPlacement(
  db: Database,
  refKind: string,
  refId: string | null,
): Promise<string | null> {
  if (!refId) return null;
  switch (refKind) {
    case "venue": {
      const [row] = await db
        .select({ slug: shopEditorialVenue.slug })
        .from(shopEditorialVenue)
        .where(eq(shopEditorialVenue.id, refId))
        .limit(1);
      return row?.slug ?? null;
    }
    case "exhibition": {
      const [row] = await db
        .select({ slug: shopEditorialExhibition.slug })
        .from(shopEditorialExhibition)
        .where(eq(shopEditorialExhibition.id, refId))
        .limit(1);
      return row?.slug ?? null;
    }
    case "story": {
      const [row] = await db
        .select({ slug: shopEditorialStory.slug })
        .from(shopEditorialStory)
        .where(eq(shopEditorialStory.id, refId))
        .limit(1);
      return row?.slug ?? null;
    }
    case "page": {
      const [row] = await db
        .select({ slug: shopEditorialPage.slug })
        .from(shopEditorialPage)
        .where(eq(shopEditorialPage.id, refId))
        .limit(1);
      return row?.slug ?? null;
    }
    default:
      return null;
  }
}

const SLUG_CONSTRAINTS = new Set([
  "shop_editorial_venue_slug_uid",
  "shop_editorial_exhibition_slug_uid",
  "shop_editorial_story_slug_uid",
  "shop_editorial_page_slug_uid",
]);

async function rethrowSlugConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    const constraint = pgUniqueViolationConstraint(error);
    if (constraint && SLUG_CONSTRAINTS.has(constraint)) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Slug is already in use", 409);
    }
    throw error;
  }
}

export function withSlugConflicts(repository: EditorialRepository): EditorialRepository {
  return {
    ...repository,
    createPage: (input) => rethrowSlugConflict(repository.createPage(input)),
    updatePage: (id, input) => rethrowSlugConflict(repository.updatePage(id, input)),
    createVenue: (input) => rethrowSlugConflict(repository.createVenue(input)),
    updateVenue: (id, input) => rethrowSlugConflict(repository.updateVenue(id, input)),
    createStory: (input) => rethrowSlugConflict(repository.createStory(input)),
    updateStory: (id, input) => rethrowSlugConflict(repository.updateStory(id, input)),
    createExhibition: (input) => rethrowSlugConflict(repository.createExhibition(input)),
    updateExhibition: (id, input) => rethrowSlugConflict(repository.updateExhibition(id, input)),
  };
}

export function createDrizzleEditorialRepository(
  db: Database,
  options: RepoOptions,
): EditorialRepository {
  const { resolveMediaUrl } = options;
  const readPublicBlocks = (value: unknown): EditorialBlock[] =>
    mapEditorialBlockMedia(readBlocks(value), resolveMediaUrl);

  const repository: EditorialRepository = {
    async listAdminVenues() {
      const rows = await db
        .select({
          id: shopEditorialVenue.id,
          slug: shopEditorialVenue.slug,
          status: shopEditorialVenue.status,
          name: shopEditorialVenue.name,
        })
        .from(shopEditorialVenue)
        .orderBy(desc(shopEditorialVenue.updatedAt));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.name,
      }));
    },

    async listAdminExhibitions() {
      const rows = await db
        .select({
          id: shopEditorialExhibition.id,
          slug: shopEditorialExhibition.slug,
          status: shopEditorialExhibition.status,
          title: shopEditorialExhibition.title,
        })
        .from(shopEditorialExhibition)
        .orderBy(desc(shopEditorialExhibition.updatedAt));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
      }));
    },

    async listAdminStories() {
      const rows = await db
        .select({
          id: shopEditorialStory.id,
          slug: shopEditorialStory.slug,
          status: shopEditorialStory.status,
          title: shopEditorialStory.title,
        })
        .from(shopEditorialStory)
        .orderBy(desc(shopEditorialStory.updatedAt));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
      }));
    },

    async listAdminPages() {
      const rows = await db
        .select({
          id: shopEditorialPage.id,
          slug: shopEditorialPage.slug,
          status: shopEditorialPage.status,
          title: shopEditorialPage.title,
        })
        .from(shopEditorialPage)
        .orderBy(desc(shopEditorialPage.updatedAt));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
      }));
    },

    async getHomePlacements() {
      const rows = await db
        .select()
        .from(shopEditorialPlacement)
        .where(isNotNull(shopEditorialPlacement.publishedAt))
        .orderBy(asc(shopEditorialPlacement.slot), asc(shopEditorialPlacement.position));
      const placements = [];
      for (const row of rows) {
        placements.push({
          slot: row.slot,
          position: row.position,
          headline: row.headline,
          mediaUrl: resolveMediaUrl(row.mediaKey),
          linkUrl: row.linkUrl,
          refKind: row.refKind,
          refSlug: await refSlugForPlacement(db, row.refKind, row.refId),
        });
      }
      return placements;
    },

    async listVenues() {
      const rows = await db
        .select({
          slug: shopEditorialVenue.slug,
          name: shopEditorialVenue.name,
          coverMediaKey: shopEditorialVenue.coverMediaKey,
        })
        .from(shopEditorialVenue)
        .where(eq(shopEditorialVenue.status, "published"))
        .orderBy(asc(shopEditorialVenue.name));
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
      }));
    },

    async getVenueBySlug(slug, opts) {
      const [row] = await db
        .select()
        .from(shopEditorialVenue)
        .where(
          and(
            eq(shopEditorialVenue.slug, slug),
            opts?.includeDraft ? undefined : eq(shopEditorialVenue.status, "published"),
          ),
        )
        .limit(1);
      if (!row) return null;
      return {
        slug: row.slug,
        name: row.name,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        address: row.address,
        postcode: row.postcode,
        openingHours: row.openingHours,
        phone: row.phone,
        email: row.email,
        mapUrl: row.mapUrl,
        body: readPublicBlocks(row.bodyBlocks),
      };
    },

    async listExhibitions(status) {
      const today = todayIsoDate();
      let dateFilter: SQL | undefined;
      if (status === "upcoming") {
        dateFilter = gt(shopEditorialExhibition.startsOn, today);
      } else if (status === "past") {
        dateFilter = lt(shopEditorialExhibition.endsOn, today);
      } else {
        dateFilter = and(
          or(
            sql`${shopEditorialExhibition.startsOn} IS NULL`,
            lte(shopEditorialExhibition.startsOn, today),
          ),
          or(
            sql`${shopEditorialExhibition.endsOn} IS NULL`,
            gte(shopEditorialExhibition.endsOn, today),
          ),
        );
      }
      const rows = await db
        .select({
          slug: shopEditorialExhibition.slug,
          kind: shopEditorialExhibition.kind,
          title: shopEditorialExhibition.title,
          summary: shopEditorialExhibition.summary,
          startsOn: shopEditorialExhibition.startsOn,
          endsOn: shopEditorialExhibition.endsOn,
          coverMediaKey: shopEditorialExhibition.coverMediaKey,
          featured: shopEditorialExhibition.featured,
        })
        .from(shopEditorialExhibition)
        .where(and(eq(shopEditorialExhibition.status, "published"), dateFilter))
        .orderBy(desc(shopEditorialExhibition.startsOn), desc(shopEditorialExhibition.createdAt));
      return rows.map((row) => ({
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        summary: row.summary,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        featured: row.featured,
      }));
    },

    async getExhibitionBySlug(slug, opts) {
      const [row] = await db
        .select()
        .from(shopEditorialExhibition)
        .where(
          and(
            eq(shopEditorialExhibition.slug, slug),
            opts?.includeDraft ? undefined : eq(shopEditorialExhibition.status, "published"),
          ),
        )
        .limit(1);
      if (!row) return null;
      let venueSlug: string | null = null;
      if (row.venueId) {
        const [venue] = await db
          .select({ slug: shopEditorialVenue.slug })
          .from(shopEditorialVenue)
          .where(eq(shopEditorialVenue.id, row.venueId))
          .limit(1);
        venueSlug = venue?.slug ?? null;
      }
      const mediaRows = await db
        .select()
        .from(shopEditorialExhibitionMedia)
        .where(eq(shopEditorialExhibitionMedia.exhibitionId, row.id))
        .orderBy(asc(shopEditorialExhibitionMedia.position));
      return {
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        summary: row.summary,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        featured: row.featured,
        timesNote: row.timesNote,
        venueSlug,
        body: readPublicBlocks(row.bodyBlocks),
        installationMedia: mediaRows
          .map((m) => {
            const url = resolveMediaUrl(m.mediaKey);
            return url ? { url, caption: m.caption } : null;
          })
          .filter((m): m is { url: string; caption: string | null } => m !== null),
      };
    },

    async listStories(kind) {
      const rows = await db
        .select({
          slug: shopEditorialStory.slug,
          kind: shopEditorialStory.kind,
          title: shopEditorialStory.title,
          standfirst: shopEditorialStory.standfirst,
          coverMediaKey: shopEditorialStory.coverMediaKey,
          featured: shopEditorialStory.featured,
        })
        .from(shopEditorialStory)
        .where(
          and(
            eq(shopEditorialStory.status, "published"),
            kind ? eq(shopEditorialStory.kind, kind) : undefined,
          ),
        )
        .orderBy(desc(shopEditorialStory.publishedAt), desc(shopEditorialStory.createdAt));
      return rows.map((row) => ({
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        standfirst: row.standfirst,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        featured: row.featured,
      }));
    },

    async getStoryBySlug(slug, opts) {
      const [row] = await db
        .select()
        .from(shopEditorialStory)
        .where(
          and(
            eq(shopEditorialStory.slug, slug),
            opts?.includeDraft ? undefined : eq(shopEditorialStory.status, "published"),
          ),
        )
        .limit(1);
      if (!row) return null;
      return {
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        standfirst: row.standfirst,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        featured: row.featured,
        videoUrl: row.videoUrl,
        body: readPublicBlocks(row.bodyBlocks),
      };
    },

    async getPageBySlug(slug, opts) {
      const [row] = await db
        .select()
        .from(shopEditorialPage)
        .where(
          and(
            eq(shopEditorialPage.slug, slug),
            opts?.includeDraft ? undefined : eq(shopEditorialPage.status, "published"),
          ),
        )
        .limit(1);
      if (!row) return null;
      return {
        slug: row.slug,
        title: row.title,
        body: readPublicBlocks(row.bodyBlocks),
      };
    },

    async insertGeneralEnquiry(input) {
      const alerts = options.generalEnquiryAlerts;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shopGeneralEnquiry)
          .values({
            identitySubjectId: input.identitySubjectId,
            topic: input.topic,
            contextSlug: input.contextSlug,
            message: input.message,
            phone: input.phone,
          })
          .returning({ id: shopGeneralEnquiry.id });
        if (!row) throw new Error("general enquiry insert returned no row");
        if (alerts?.opsEmail.trim()) {
          await alerts.notifications.queueGeneralEnquiryAlert(tx, {
            idempotencyKey: `general-enquiry:${row.id}`,
            identitySubjectId: input.identitySubjectId,
            opsEmail: alerts.opsEmail.trim(),
            topic: input.topic,
            contextSlug: input.contextSlug,
            message: input.message,
            phone: input.phone,
          });
        }
        return { enquiryId: row.id };
      });
    },

    async listGeneralEnquiriesForSubject(identitySubjectId) {
      const rows = await db
        .select()
        .from(shopGeneralEnquiry)
        .where(eq(shopGeneralEnquiry.identitySubjectId, identitySubjectId))
        .orderBy(desc(shopGeneralEnquiry.createdAt))
        .limit(50);
      return rows.map((row) => ({
        enquiryId: row.id,
        topic: row.topic,
        contextSlug: row.contextSlug,
        message: row.message,
        phone: row.phone,
        createdAt: row.createdAt,
      }));
    },

    async listAdminGeneralEnquiries(input) {
      const limit = input?.limit ?? 50;
      const rows = await db
        .select()
        .from(shopGeneralEnquiry)
        .orderBy(desc(shopGeneralEnquiry.createdAt))
        .limit(limit);
      return rows.map((row) => ({
        enquiryId: row.id,
        identitySubjectId: row.identitySubjectId,
        topic: row.topic,
        contextSlug: row.contextSlug,
        message: row.message,
        phone: row.phone,
        createdAt: row.createdAt,
      }));
    },

    async getDraftEntityById(entity, id) {
      switch (entity) {
        case "venue": {
          const [row] = await db
            .select()
            .from(shopEditorialVenue)
            .where(eq(shopEditorialVenue.id, id))
            .limit(1);
          if (!row) return null;
          return {
            slug: row.slug,
            name: row.name,
            coverUrl: resolveMediaUrl(row.coverMediaKey),
            address: row.address,
            postcode: row.postcode,
            openingHours: row.openingHours,
            phone: row.phone,
            email: row.email,
            mapUrl: row.mapUrl,
            body: readPublicBlocks(row.bodyBlocks),
          };
        }
        case "exhibition":
          return this.getExhibitionBySlug(
            (
              await db
                .select({ slug: shopEditorialExhibition.slug })
                .from(shopEditorialExhibition)
                .where(eq(shopEditorialExhibition.id, id))
                .limit(1)
            )[0]?.slug ?? "",
            { includeDraft: true },
          );
        case "story":
          return this.getStoryBySlug(
            (
              await db
                .select({ slug: shopEditorialStory.slug })
                .from(shopEditorialStory)
                .where(eq(shopEditorialStory.id, id))
                .limit(1)
            )[0]?.slug ?? "",
            { includeDraft: true },
          );
        case "page":
          return this.getPageBySlug(
            (
              await db
                .select({ slug: shopEditorialPage.slug })
                .from(shopEditorialPage)
                .where(eq(shopEditorialPage.id, id))
                .limit(1)
            )[0]?.slug ?? "",
            { includeDraft: true },
          );
        default:
          return null;
      }
    },

    async getAdminPageById(id) {
      const [row] = await db
        .select()
        .from(shopEditorialPage)
        .where(eq(shopEditorialPage.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        title: row.title,
        body: readBlocks(row.bodyBlocks),
      };
    },

    async createPage(input) {
      const body = parseEditorialBlocks(input.body);
      const [row] = await db
        .insert(shopEditorialPage)
        .values({
          slug: input.slug,
          title: input.title,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
        })
        .returning({ id: shopEditorialPage.id });
      if (!row) throw new Error("editorial_page_create_failed");
      return { id: row.id };
    },

    async updatePage(id, input) {
      const body = parseEditorialBlocks(input.body);
      await db
        .update(shopEditorialPage)
        .set({
          slug: input.slug,
          title: input.title,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialPage.id, id));
    },

    async setPagePublication(id, published, updatedBy) {
      await db
        .update(shopEditorialPage)
        .set({
          status: published ? "published" : "draft",
          publishedAt: published ? new Date() : null,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialPage.id, id));
    },

    async getAdminVenueById(id) {
      const [row] = await db
        .select()
        .from(shopEditorialVenue)
        .where(eq(shopEditorialVenue.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.name,
        name: row.name,
        address: row.address,
        postcode: row.postcode,
        openingHours: row.openingHours,
        phone: row.phone,
        email: row.email,
        mapUrl: row.mapUrl,
        coverMediaKey: row.coverMediaKey,
        body: readBlocks(row.bodyBlocks),
      };
    },

    async createVenue(input) {
      const body = parseEditorialBlocks(input.body);
      const [row] = await db
        .insert(shopEditorialVenue)
        .values({
          slug: input.slug,
          name: input.name,
          address: input.address,
          postcode: input.postcode,
          openingHours: input.openingHours,
          phone: input.phone,
          email: input.email,
          mapUrl: input.mapUrl,
          coverMediaKey: input.coverMediaKey,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
        })
        .returning({ id: shopEditorialVenue.id });
      if (!row) throw new Error("editorial_venue_create_failed");
      return { id: row.id };
    },

    async updateVenue(id, input) {
      const body = parseEditorialBlocks(input.body);
      await db
        .update(shopEditorialVenue)
        .set({
          slug: input.slug,
          name: input.name,
          address: input.address,
          postcode: input.postcode,
          openingHours: input.openingHours,
          phone: input.phone,
          email: input.email,
          mapUrl: input.mapUrl,
          coverMediaKey: input.coverMediaKey,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialVenue.id, id));
    },

    async setVenuePublication(id, published, updatedBy) {
      await db
        .update(shopEditorialVenue)
        .set({
          status: published ? "published" : "draft",
          publishedAt: published ? new Date() : null,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialVenue.id, id));
    },

    async getAdminStoryById(id) {
      const [row] = await db
        .select()
        .from(shopEditorialStory)
        .where(eq(shopEditorialStory.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        kind: row.kind,
        title: row.title,
        standfirst: row.standfirst,
        coverMediaKey: row.coverMediaKey,
        videoUrl: row.videoUrl,
        featured: row.featured,
        body: readBlocks(row.bodyBlocks),
      };
    },

    async createStory(input) {
      const body = parseEditorialBlocks(input.body);
      const [row] = await db
        .insert(shopEditorialStory)
        .values({
          slug: input.slug,
          kind: input.kind,
          title: input.title,
          standfirst: input.standfirst,
          coverMediaKey: input.coverMediaKey,
          videoUrl: input.videoUrl,
          featured: input.featured,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
        })
        .returning({ id: shopEditorialStory.id });
      if (!row) throw new Error("editorial_story_create_failed");
      return { id: row.id };
    },

    async updateStory(id, input) {
      const body = parseEditorialBlocks(input.body);
      await db
        .update(shopEditorialStory)
        .set({
          slug: input.slug,
          kind: input.kind,
          title: input.title,
          standfirst: input.standfirst,
          coverMediaKey: input.coverMediaKey,
          videoUrl: input.videoUrl,
          featured: input.featured,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialStory.id, id));
    },

    async setStoryPublication(id, published, updatedBy) {
      await db
        .update(shopEditorialStory)
        .set({
          status: published ? "published" : "draft",
          publishedAt: published ? new Date() : null,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialStory.id, id));
    },

    async getAdminExhibitionById(id) {
      const [row] = await db
        .select()
        .from(shopEditorialExhibition)
        .where(eq(shopEditorialExhibition.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        kind: row.kind,
        title: row.title,
        summary: row.summary,
        venueId: row.venueId,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        timesNote: row.timesNote,
        coverMediaKey: row.coverMediaKey,
        featured: row.featured,
        body: readBlocks(row.bodyBlocks),
      };
    },

    async createExhibition(input) {
      const body = parseEditorialBlocks(input.body);
      const [row] = await db
        .insert(shopEditorialExhibition)
        .values({
          slug: input.slug,
          kind: input.kind,
          title: input.title,
          summary: input.summary,
          venueId: input.venueId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          timesNote: input.timesNote,
          coverMediaKey: input.coverMediaKey,
          featured: input.featured,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
        })
        .returning({ id: shopEditorialExhibition.id });
      if (!row) throw new Error("editorial_exhibition_create_failed");
      return { id: row.id };
    },

    async updateExhibition(id, input) {
      const body = parseEditorialBlocks(input.body);
      await db
        .update(shopEditorialExhibition)
        .set({
          slug: input.slug,
          kind: input.kind,
          title: input.title,
          summary: input.summary,
          venueId: input.venueId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          timesNote: input.timesNote,
          coverMediaKey: input.coverMediaKey,
          featured: input.featured,
          bodyBlocks: body,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialExhibition.id, id));
    },

    async setExhibitionPublication(id, published, updatedBy) {
      await db
        .update(shopEditorialExhibition)
        .set({
          status: published ? "published" : "draft",
          publishedAt: published ? new Date() : null,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shopEditorialExhibition.id, id));
    },

    async listAdminPlacements() {
      const rows = await db
        .select()
        .from(shopEditorialPlacement)
        .orderBy(asc(shopEditorialPlacement.slot), asc(shopEditorialPlacement.position));
      return rows.map((row) => ({
        id: row.id,
        slot: row.slot,
        position: row.position,
        refKind: row.refKind,
        refId: row.refId,
        headline: row.headline,
        mediaKey: row.mediaKey,
        linkUrl: row.linkUrl,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      }));
    },

    async replacePlacementSlot(slot, items, updatedBy) {
      await db.transaction(async (tx) => {
        await tx
          .delete(shopEditorialPlacement)
          .where(eq(shopEditorialPlacement.slot, slot as never));
        if (items.length === 0) return;
        await tx.insert(shopEditorialPlacement).values(
          items.map((item) => ({
            slot: slot as never,
            position: item.position,
            refKind: item.refKind as never,
            refId: item.refId,
            headline: item.headline,
            mediaKey: item.mediaKey,
            linkUrl: item.linkUrl,
            publishedAt: new Date(),
            updatedAt: new Date(),
          })),
        );
        void updatedBy;
      });
    },
  };
  return withSlugConflicts(repository);
}
