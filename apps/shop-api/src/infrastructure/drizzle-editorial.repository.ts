import type { Database } from "@auction/db";
import {
  shopEditorialExhibition,
  shopEditorialExhibitionMedia,
  shopEditorialPage,
  shopEditorialPlacement,
  shopEditorialStory,
  shopEditorialVenue,
  shopGeneralEnquiry,
  shopHelpArticle,
} from "@auction/db/schema";
import {
  EDITORIAL_STORY_DEFAULT_CATEGORIES,
  type EditorialBlock,
  type EditorialStoryCategory,
  SHOP_API_ERROR_CODES,
  estimateEditorialReadMinutes,
  mapEditorialBlockMedia,
  parseEditorialBlocks,
} from "@auction/shop-contracts";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { londonIsoDate } from "../application/editorial-calendar-date.js";
import { enquirySenderColumns } from "../application/enquiry-sender.js";
import type {
  EditorialExhibitionExtraFields,
  EditorialRepository,
  EditorialStoryExtraFields,
  EditorialUpdateOutcome,
  EditorialVenueExtraFields,
} from "../application/ports/editorial.repository.js";
import type { EnquiryFollowUp } from "../application/ports/enquiry-follow-up.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import {
  blankToNull,
  createEditorialRelationQueries,
  exhibitionSummaryOrder,
  selectExhibitionSummaries,
  selectStorySummaries,
  storySummaryOrder,
  toExhibitionSummary,
  toStorySummary,
} from "./drizzle-editorial-relations.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

type RepoOptions = {
  resolveMediaUrl: (value: string | null | undefined) => string | null;
  /** Staff alert queued in the same transaction as each general enquiry. */
  generalEnquiryAlerts?: { notifications: ShopNotificationPublisher; opsEmail: string };
  /** The lead and the sender's copy, after each general enquiry is stored. */
  enquiryFollowUp?: EnquiryFollowUp;
};

function seoColumns(input: { seoTitle?: string | null; seoDescription?: string | null }) {
  return {
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
  };
}

/** Drops keys whose value is `undefined`, so an omitted field leaves the stored column unchanged. */
function definedOnly<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Matches a story's category, treating a blank category as the default for its kind. */
function storyCategoryIs(category: EditorialStoryCategory): SQL {
  const defaultingKinds = EDITORIAL_STORY_DEFAULT_CATEGORIES.filter(
    ([, fallback]) => fallback === category,
  ).map(([kind]) => kind);
  const explicit = eq(shopEditorialStory.category, category);
  if (defaultingKinds.length === 0) return explicit;
  return or(
    explicit,
    and(isNull(shopEditorialStory.category), inArray(shopEditorialStory.kind, defaultingKinds)),
  ) as SQL;
}

type VenueRow = typeof shopEditorialVenue.$inferSelect;

function venueExtraColumns(input: Partial<EditorialVenueExtraFields>) {
  return definedOnly({
    streetLine: input.streetLine,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

function exhibitionExtraColumns(input: Partial<EditorialExhibitionExtraFields>) {
  return definedOnly({
    subtitle: input.subtitle,
    contactName: input.contactName,
    contactRole: input.contactRole,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    contactAvatarMediaKey: input.contactAvatarMediaKey,
  });
}

/** The read-time estimate always follows the saved body; the editor's override is separate. */
function storyExtraColumns(input: Partial<EditorialStoryExtraFields>, body: EditorialBlock[]) {
  return {
    ...definedOnly({
      category: input.category,
      authorName: input.authorName,
      readMinutes: input.readMinutes,
      series: input.series,
      episodeNumber: input.episodeNumber,
      audioUrl: input.audioUrl,
      durationSeconds: input.durationSeconds,
      publicationName: input.publicationName,
      externalUrl: input.externalUrl,
    }),
    readMinutesEstimate: estimateEditorialReadMinutes(body),
  };
}

/** Drops individual blocks that no longer satisfy the contract instead of blanking the body. */
export function readBlocks(value: unknown): EditorialBlock[] {
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
  "shop_help_category_slug_uid",
  "shop_help_article_slug_uid",
]);

export async function rethrowSlugConflict<T>(write: Promise<T>): Promise<T> {
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

export type EditorialAuditExecutor = Pick<Database, "insert">;

/** Written on the same executor as the change so the two commit or roll back together. */
export function auditEditorialWrite(
  executor: EditorialAuditExecutor,
  actorSubjectId: string,
  capability: "editorial.write" | "editorial.publish",
  action: string,
  targetType: string,
  targetId: string,
  afterJson?: Record<string, unknown>,
): Promise<void> {
  return insertShopAdminAudit(executor as Database, {
    actorSubjectId,
    capability,
    action,
    targetType,
    targetId,
    ...(afterJson ? { afterJson } : {}),
  });
}

/**
 * Postgres keeps microseconds but the version travels as a millisecond ISO string, so the stored
 * value is truncated before comparing; otherwise rows written by SQL `now()` could never match.
 */
export function sameVersion(updatedAt: AnyPgColumn, expectedVersion: string): SQL {
  return sql`date_trunc('milliseconds', ${updatedAt}) = ${new Date(expectedVersion)}`;
}

type VersionedTable = PgTable & { id: AnyPgColumn; updatedAt: AnyPgColumn };

/** Runs on the transaction whose guarded UPDATE matched nothing, to say why. */
export async function resolveRejectedUpdate(
  tx: EditorialAuditExecutor & Pick<Database, "select">,
  table: VersionedTable,
  id: string,
): Promise<EditorialUpdateOutcome> {
  const [current] = await tx
    .select({ updatedAt: table.updatedAt })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!current) return { status: "not_found" };
  return { status: "stale", currentVersion: (current.updatedAt as Date).toISOString() };
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
  const relations = createEditorialRelationQueries(db, resolveMediaUrl);
  const toVenueDetail = (row: VenueRow) => ({
    slug: row.slug,
    name: row.name,
    coverUrl: resolveMediaUrl(row.coverMediaKey),
    streetLine: row.streetLine,
    postcode: row.postcode,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.openingHours,
    phone: row.phone,
    email: row.email,
    mapUrl: row.mapUrl,
    body: readPublicBlocks(row.bodyBlocks),
  });

  const repository: EditorialRepository = {
    async listAdminVenues() {
      const rows = await db
        .select({
          id: shopEditorialVenue.id,
          slug: shopEditorialVenue.slug,
          status: shopEditorialVenue.status,
          updatedAt: shopEditorialVenue.updatedAt,
          city: shopEditorialVenue.city,
          name: shopEditorialVenue.name,
        })
        .from(shopEditorialVenue)
        .orderBy(desc(shopEditorialVenue.updatedAt), desc(shopEditorialVenue.id));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.name,
        updatedAt: row.updatedAt.toISOString(),
        city: row.city,
      }));
    },

    async listAdminExhibitions() {
      const rows = await db
        .select({
          id: shopEditorialExhibition.id,
          slug: shopEditorialExhibition.slug,
          status: shopEditorialExhibition.status,
          updatedAt: shopEditorialExhibition.updatedAt,
          kind: shopEditorialExhibition.kind,
          startsOn: shopEditorialExhibition.startsOn,
          endsOn: shopEditorialExhibition.endsOn,
          title: shopEditorialExhibition.title,
        })
        .from(shopEditorialExhibition)
        .orderBy(desc(shopEditorialExhibition.updatedAt), desc(shopEditorialExhibition.id));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        updatedAt: row.updatedAt.toISOString(),
        kind: row.kind,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
      }));
    },

    async listAdminStories() {
      const rows = await db
        .select({
          id: shopEditorialStory.id,
          slug: shopEditorialStory.slug,
          status: shopEditorialStory.status,
          updatedAt: shopEditorialStory.updatedAt,
          kind: shopEditorialStory.kind,
          title: shopEditorialStory.title,
        })
        .from(shopEditorialStory)
        .orderBy(desc(shopEditorialStory.updatedAt), desc(shopEditorialStory.id));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        updatedAt: row.updatedAt.toISOString(),
        kind: row.kind,
      }));
    },

    async listAdminPages() {
      const rows = await db
        .select({
          id: shopEditorialPage.id,
          slug: shopEditorialPage.slug,
          status: shopEditorialPage.status,
          updatedAt: shopEditorialPage.updatedAt,
          title: shopEditorialPage.title,
        })
        .from(shopEditorialPage)
        .orderBy(desc(shopEditorialPage.updatedAt), desc(shopEditorialPage.id));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        label: row.title,
        updatedAt: row.updatedAt.toISOString(),
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
          body: row.body,
          ctaLabel: row.ctaLabel,
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
          streetLine: shopEditorialVenue.streetLine,
          postcode: shopEditorialVenue.postcode,
          city: shopEditorialVenue.city,
        })
        .from(shopEditorialVenue)
        .where(eq(shopEditorialVenue.status, "published"))
        .orderBy(asc(shopEditorialVenue.name));
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        streetLine: row.streetLine,
        postcode: row.postcode,
        city: row.city,
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
      return row ? toVenueDetail(row) : null;
    },

    async listExhibitions(status) {
      const today = londonIsoDate(new Date());
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
      const rows = await selectExhibitionSummaries(db)
        .where(and(eq(shopEditorialExhibition.status, "published"), dateFilter))
        .orderBy(...exhibitionSummaryOrder);
      return rows.map((row) => toExhibitionSummary(row, resolveMediaUrl));
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
      const [venue] = row.venueId
        ? await db
            .select({
              slug: shopEditorialVenue.slug,
              name: shopEditorialVenue.name,
              status: shopEditorialVenue.status,
            })
            .from(shopEditorialVenue)
            .where(eq(shopEditorialVenue.id, row.venueId))
            .limit(1)
        : [];
      const [mediaRows, related] = await Promise.all([
        db
          .select()
          .from(shopEditorialExhibitionMedia)
          .where(eq(shopEditorialExhibitionMedia.exhibitionId, row.id))
          .orderBy(asc(shopEditorialExhibitionMedia.position)),
        relations.exhibitionRelations(row.id),
      ]);
      return {
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        summary: row.summary,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        coverUrl: resolveMediaUrl(row.coverMediaKey),
        featured: row.featured,
        subtitle: blankToNull(row.subtitle),
        venue: venue?.status === "published" ? { slug: venue.slug, name: venue.name } : null,
        timesNote: row.timesNote,
        venueSlug: venue?.slug ?? null,
        contact: blankToNull(row.contactName)
          ? {
              name: row.contactName as string,
              role: row.contactRole,
              email: row.contactEmail,
              phone: row.contactPhone,
              avatarUrl: resolveMediaUrl(row.contactAvatarMediaKey),
            }
          : null,
        ...related,
        body: readPublicBlocks(row.bodyBlocks),
        installationMedia: mediaRows
          .map((m) => {
            const url = resolveMediaUrl(m.mediaKey);
            return url ? { url, caption: m.caption } : null;
          })
          .filter((m): m is { url: string; caption: string | null } => m !== null),
      };
    },

    async listStories(filter) {
      const rows = await selectStorySummaries(db)
        .where(
          and(
            eq(shopEditorialStory.status, "published"),
            filter?.kind ? eq(shopEditorialStory.kind, filter.kind) : undefined,
            filter?.category ? storyCategoryIs(filter.category) : undefined,
            filter?.series ? eq(shopEditorialStory.series, filter.series) : undefined,
          ),
        )
        .orderBy(...storySummaryOrder);
      return rows.map((row) => ({
        ...toStorySummary(row, resolveMediaUrl),
        updatedAt: row.updatedAt.toISOString(),
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
      const body = readPublicBlocks(row.bodyBlocks);
      const summary = toStorySummary(row, resolveMediaUrl);
      return {
        ...summary,
        // Stories saved before the estimate column existed get one from the body here.
        readMinutes: summary.readMinutes ?? estimateEditorialReadMinutes(body),
        videoUrl: row.videoUrl,
        audioUrl: row.audioUrl,
        body,
        related: await relations.storyRelations(row.id),
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      };
    },

    getArtistRelations: (artistSlug) => relations.artistRelations(artistSlug),

    async listPages() {
      const rows = await db
        .select({
          slug: shopEditorialPage.slug,
          title: shopEditorialPage.title,
          updatedAt: shopEditorialPage.updatedAt,
        })
        .from(shopEditorialPage)
        .where(eq(shopEditorialPage.status, "published"))
        .orderBy(asc(shopEditorialPage.slug));
      return rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
      }));
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
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      };
    },

    async insertGeneralEnquiry(input) {
      const alerts = options.generalEnquiryAlerts;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shopGeneralEnquiry)
          .values({
            ...enquirySenderColumns(input.sender),
            topic: input.topic,
            contextSlug: input.contextSlug,
            message: input.message,
            phone: input.phone,
          })
          .returning({ id: shopGeneralEnquiry.id, reference: shopGeneralEnquiry.reference });
        if (!row) throw new Error("general enquiry insert returned no row");
        if (alerts?.opsEmail.trim()) {
          await alerts.notifications.queueGeneralEnquiryAlert(tx, {
            idempotencyKey: `general-enquiry:${row.id}`,
            sender: input.sender,
            opsEmail: alerts.opsEmail.trim(),
            topic: input.topic,
            contextSlug: input.contextSlug,
            message: input.message,
            phone: input.phone,
          });
        }
        await options.enquiryFollowUp?.afterStored(
          tx,
          {
            reference: row.reference,
            sender: input.sender,
            phone: input.phone,
            // General enquiries are sent from lax.art.
            salesChannel: "art",
            topic: input.topic,
          },
          new Date(),
        );
        return { enquiryId: row.id, reference: row.reference };
      });
    },

    async listGeneralEnquiriesForSubject(identitySubjectId) {
      const rows = await db
        .select()
        .from(shopGeneralEnquiry)
        .where(
          and(
            eq(shopGeneralEnquiry.identitySubjectId, identitySubjectId),
            // Problems reported on a Shop order belong to that order, not to the enquiry list.
            sql`${shopGeneralEnquiry.topic} <> 'order_problem'`,
          ),
        )
        .orderBy(desc(shopGeneralEnquiry.createdAt))
        .limit(50);
      return rows.flatMap(({ topic, ...row }) =>
        topic === "order_problem"
          ? []
          : [
              {
                enquiryId: row.id,
                topic,
                contextSlug: row.contextSlug,
                message: row.message,
                phone: row.phone,
                createdAt: row.createdAt,
              },
            ],
      );
    },

    async getDraftEntityById(entity, id) {
      switch (entity) {
        case "venue": {
          const [row] = await db
            .select()
            .from(shopEditorialVenue)
            .where(eq(shopEditorialVenue.id, id))
            .limit(1);
          return row ? toVenueDetail(row) : null;
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
        case "help_article": {
          // A help answer previews as a page whose title is the question, so lax.art needs no
          // separate preview layout for it.
          const [row] = await db
            .select()
            .from(shopHelpArticle)
            .where(eq(shopHelpArticle.id, id))
            .limit(1);
          return row
            ? {
                slug: row.slug,
                title: row.question,
                body: readPublicBlocks(row.answerBlocks),
                seoTitle: row.seoTitle,
                seoDescription: row.seoDescription,
              }
            : null;
        }
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
        updatedAt: row.updatedAt.toISOString(),
        title: row.title,
        body: readBlocks(row.bodyBlocks),
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      };
    },

    async createPage(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shopEditorialPage)
          .values({
            slug: input.slug,
            title: input.title,
            bodyBlocks: body,
            ...seoColumns(input),
            updatedBy: input.updatedBy,
          })
          .returning({ id: shopEditorialPage.id });
        if (!row) throw new Error("editorial_page_create_failed");
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.page.create",
          "editorial_page",
          row.id,
        );
        return { id: row.id };
      });
    },

    async updatePage(id, input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(shopEditorialPage)
          .set({
            slug: input.slug,
            title: input.title,
            bodyBlocks: body,
            ...seoColumns(input),
            updatedBy: input.updatedBy,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(shopEditorialPage.id, id),
              sameVersion(shopEditorialPage.updatedAt, input.expectedVersion),
            ),
          )
          .returning({ id: shopEditorialPage.id, updatedAt: shopEditorialPage.updatedAt });
        if (!row) return resolveRejectedUpdate(tx, shopEditorialPage, id);
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.page.update",
          "editorial_page",
          row.id,
        );
        return { status: "updated", version: row.updatedAt.toISOString() };
      });
    },

    async setPagePublication(id, published, updatedBy) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(shopEditorialPage)
          .set({
            status: published ? "published" : "draft",
            publishedAt: published ? new Date() : null,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(shopEditorialPage.id, id))
          .returning({ id: shopEditorialPage.id });
        if (row)
          await auditEditorialWrite(
            tx,
            updatedBy,
            "editorial.publish",
            published ? "editorial.page.publish" : "editorial.page.unpublish",
            "editorial_page",
            row.id,
          );
      });
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
        updatedAt: row.updatedAt.toISOString(),
        name: row.name,
        address: row.address,
        postcode: row.postcode,
        openingHours: row.openingHours,
        phone: row.phone,
        email: row.email,
        mapUrl: row.mapUrl,
        coverMediaKey: row.coverMediaKey,
        body: readBlocks(row.bodyBlocks),
        streetLine: row.streetLine,
        city: row.city,
        latitude: row.latitude,
        longitude: row.longitude,
      };
    },

    async createVenue(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...venueExtraColumns(input),
            updatedBy: input.updatedBy,
          })
          .returning({ id: shopEditorialVenue.id });
        if (!row) throw new Error("editorial_venue_create_failed");
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.venue.create",
          "editorial_venue",
          row.id,
        );
        return { id: row.id };
      });
    },

    async updateVenue(id, input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...venueExtraColumns(input),
            updatedBy: input.updatedBy,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(shopEditorialVenue.id, id),
              sameVersion(shopEditorialVenue.updatedAt, input.expectedVersion),
            ),
          )
          .returning({ id: shopEditorialVenue.id, updatedAt: shopEditorialVenue.updatedAt });
        if (!row) return resolveRejectedUpdate(tx, shopEditorialVenue, id);
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.venue.update",
          "editorial_venue",
          row.id,
        );
        return { status: "updated", version: row.updatedAt.toISOString() };
      });
    },

    async setVenuePublication(id, published, updatedBy) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(shopEditorialVenue)
          .set({
            status: published ? "published" : "draft",
            publishedAt: published ? new Date() : null,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(shopEditorialVenue.id, id))
          .returning({ id: shopEditorialVenue.id });
        if (row)
          await auditEditorialWrite(
            tx,
            updatedBy,
            "editorial.publish",
            published ? "editorial.venue.publish" : "editorial.venue.unpublish",
            "editorial_venue",
            row.id,
          );
      });
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
        updatedAt: row.updatedAt.toISOString(),
        kind: row.kind,
        title: row.title,
        standfirst: row.standfirst,
        coverMediaKey: row.coverMediaKey,
        videoUrl: row.videoUrl,
        featured: row.featured,
        body: readBlocks(row.bodyBlocks),
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        category: row.category,
        authorName: row.authorName,
        readMinutes: row.readMinutes,
        series: row.series,
        episodeNumber: row.episodeNumber,
        audioUrl: row.audioUrl,
        durationSeconds: row.durationSeconds,
        publicationName: row.publicationName,
        externalUrl: row.externalUrl,
      };
    },

    async createStory(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...seoColumns(input),
            ...storyExtraColumns(input, body),
            updatedBy: input.updatedBy,
          })
          .returning({ id: shopEditorialStory.id });
        if (!row) throw new Error("editorial_story_create_failed");
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.story.create",
          "editorial_story",
          row.id,
        );
        return { id: row.id };
      });
    },

    async updateStory(id, input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...seoColumns(input),
            ...storyExtraColumns(input, body),
            updatedBy: input.updatedBy,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(shopEditorialStory.id, id),
              sameVersion(shopEditorialStory.updatedAt, input.expectedVersion),
            ),
          )
          .returning({ id: shopEditorialStory.id, updatedAt: shopEditorialStory.updatedAt });
        if (!row) return resolveRejectedUpdate(tx, shopEditorialStory, id);
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.story.update",
          "editorial_story",
          row.id,
        );
        return { status: "updated", version: row.updatedAt.toISOString() };
      });
    },

    async setStoryPublication(id, published, updatedBy) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(shopEditorialStory)
          .set({
            status: published ? "published" : "draft",
            publishedAt: published ? new Date() : null,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(shopEditorialStory.id, id))
          .returning({ id: shopEditorialStory.id });
        if (row)
          await auditEditorialWrite(
            tx,
            updatedBy,
            "editorial.publish",
            published ? "editorial.story.publish" : "editorial.story.unpublish",
            "editorial_story",
            row.id,
          );
      });
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
        updatedAt: row.updatedAt.toISOString(),
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
        subtitle: row.subtitle,
        contactName: row.contactName,
        contactRole: row.contactRole,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        contactAvatarMediaKey: row.contactAvatarMediaKey,
      };
    },

    async createExhibition(input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...exhibitionExtraColumns(input),
            updatedBy: input.updatedBy,
          })
          .returning({ id: shopEditorialExhibition.id });
        if (!row) throw new Error("editorial_exhibition_create_failed");
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.exhibition.create",
          "editorial_exhibition",
          row.id,
        );
        return { id: row.id };
      });
    },

    async updateExhibition(id, input) {
      const body = parseEditorialBlocks(input.body);
      return db.transaction(async (tx) => {
        const [row] = await tx
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
            ...exhibitionExtraColumns(input),
            updatedBy: input.updatedBy,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(shopEditorialExhibition.id, id),
              sameVersion(shopEditorialExhibition.updatedAt, input.expectedVersion),
            ),
          )
          .returning({
            id: shopEditorialExhibition.id,
            updatedAt: shopEditorialExhibition.updatedAt,
          });
        if (!row) return resolveRejectedUpdate(tx, shopEditorialExhibition, id);
        await auditEditorialWrite(
          tx,
          input.updatedBy,
          "editorial.write",
          "editorial.exhibition.update",
          "editorial_exhibition",
          row.id,
        );
        return { status: "updated", version: row.updatedAt.toISOString() };
      });
    },

    async setExhibitionPublication(id, published, updatedBy) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(shopEditorialExhibition)
          .set({
            status: published ? "published" : "draft",
            publishedAt: published ? new Date() : null,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(shopEditorialExhibition.id, id))
          .returning({ id: shopEditorialExhibition.id });
        if (row)
          await auditEditorialWrite(
            tx,
            updatedBy,
            "editorial.publish",
            published ? "editorial.exhibition.publish" : "editorial.exhibition.unpublish",
            "editorial_exhibition",
            row.id,
          );
      });
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
        body: row.body,
        ctaLabel: row.ctaLabel,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      }));
    },

    async replacePlacementSlot(slot, items, updatedBy) {
      await db.transaction(async (tx) => {
        await tx
          .delete(shopEditorialPlacement)
          .where(eq(shopEditorialPlacement.slot, slot as never));
        if (items.length > 0) {
          await tx.insert(shopEditorialPlacement).values(
            items.map((item) => ({
              slot: slot as never,
              position: item.position,
              refKind: item.refKind as never,
              refId: item.refId,
              headline: item.headline,
              mediaKey: item.mediaKey,
              linkUrl: item.linkUrl,
              body: item.body ?? null,
              ctaLabel: item.ctaLabel ?? null,
              publishedAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
        await auditEditorialWrite(
          tx,
          updatedBy,
          "editorial.publish",
          "editorial.placement.replace",
          "editorial_placement",
          slot,
          {
            items: items.length,
          },
        );
      });
    },

    async recordPreviewTokenIssued(entity, id, actorSubjectId) {
      await auditEditorialWrite(
        db,
        actorSubjectId,
        "editorial.write",
        "editorial.preview_token.issue",
        `editorial_${entity}`,
        id,
      );
    },
  };
  return withSlugConflicts(repository);
}
