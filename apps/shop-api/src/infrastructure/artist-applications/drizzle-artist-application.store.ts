import type { Database } from "@auction/db";
import {
  shopArtistApplication,
  shopArtistApplicationEvent,
  shopArtistApplicationWork,
  shopMediaAsset,
} from "@auction/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import type {
  ArtistApplicationImage,
  ArtistApplicationRecord,
  ArtistApplicationStore,
} from "../../application/artist-applications/artist-application.ports.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;
type ApplicationRow = typeof shopArtistApplication.$inferSelect;

/** Every write moves the version on and stamps the time, so stale copies are always caught. */
const bump = {
  version: sql`${shopArtistApplication.version} + 1`,
  updatedAt: sql`now()`,
};

/** Applications on one database session (a transaction when called through the unit of work). */
export function createDrizzleArtistApplicationStore(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): ArtistApplicationStore {
  async function worksOf(applicationId: string) {
    return db
      .select({
        mediaKey: shopArtistApplicationWork.mediaKey,
        title: shopArtistApplicationWork.title,
        year: shopArtistApplicationWork.year,
        medium: shopArtistApplicationWork.medium,
        size: shopArtistApplicationWork.size,
        kind: shopArtistApplicationWork.kind,
        width: shopMediaAsset.width,
        height: shopMediaAsset.height,
      })
      .from(shopArtistApplicationWork)
      .leftJoin(shopMediaAsset, eq(shopMediaAsset.key, shopArtistApplicationWork.mediaKey))
      .where(eq(shopArtistApplicationWork.applicationId, applicationId))
      .orderBy(asc(shopArtistApplicationWork.position));
  }

  async function toRecord(row: ApplicationRow): Promise<ArtistApplicationRecord> {
    const works = await worksOf(row.id);
    const images = new Map<string, ArtistApplicationImage>(
      works.map((work) => [
        work.mediaKey,
        {
          url: options.resolveMediaUrl(work.mediaKey),
          width: work.width,
          height: work.height,
        },
      ]),
    );
    return {
      id: row.id,
      reference: row.reference,
      applicantSubjectId: row.applicantSubjectId,
      status: row.status,
      content: {
        artistName: row.artistName,
        location: row.location,
        website: row.website,
        socialLinks: row.socialLinks,
        shortBio: row.shortBio,
        statement: row.statement,
        representation: row.representation,
        exhibitions: row.exhibitions,
        consentToContact: row.consentToContact,
        works: works.map((work) => ({
          mediaKey: work.mediaKey,
          title: work.title,
          year: work.year,
          medium: work.medium,
          size: work.size,
          kind: work.kind,
        })),
      },
      contactEmail: row.contactEmail,
      assigneeSubject: row.assigneeSubject,
      messageToArtist: row.messageToArtist,
      artistId: row.artistId,
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      version: row.version,
      updatedAt: row.updatedAt,
      images,
    };
  }

  async function latest(applicantSubjectId: string): Promise<ArtistApplicationRecord | null> {
    const [row] = await db
      .select()
      .from(shopArtistApplication)
      .where(eq(shopArtistApplication.applicantSubjectId, applicantSubjectId))
      .orderBy(desc(shopArtistApplication.createdAt), desc(shopArtistApplication.id))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  return {
    latestForApplicant: latest,

    async lock(id) {
      const [row] = await db
        .select()
        .from(shopArtistApplication)
        .where(eq(shopArtistApplication.id, id))
        .for("update")
        .limit(1);
      return row ? toRecord(row) : null;
    },

    /** A second start racing the first finds the open application instead of making another. */
    async insertDraft(applicantSubjectId) {
      const [row] = await db
        .insert(shopArtistApplication)
        .values({ applicantSubjectId })
        .onConflictDoNothing()
        .returning();
      if (row) return toRecord(row);
      const open = await latest(applicantSubjectId);
      if (!open) throw new Error("artist application insert lost its race but none is open");
      return open;
    },

    async saveContent(id, content) {
      await db
        .update(shopArtistApplication)
        .set({
          artistName: content.artistName,
          location: content.location,
          website: content.website,
          socialLinks: [...content.socialLinks],
          shortBio: content.shortBio,
          statement: content.statement,
          representation: content.representation,
          exhibitions: content.exhibitions,
          consentToContact: content.consentToContact,
          ...bump,
        })
        .where(eq(shopArtistApplication.id, id));
      await db
        .delete(shopArtistApplicationWork)
        .where(eq(shopArtistApplicationWork.applicationId, id));
      if (content.works.length === 0) return;
      await db.insert(shopArtistApplicationWork).values(
        content.works.map((work, position) => ({
          applicationId: id,
          position,
          mediaKey: work.mediaKey,
          title: work.title,
          year: work.year,
          medium: work.medium,
          size: work.size,
          kind: work.kind,
        })),
      );
    },

    async appendWork(id, mediaKey) {
      const [{ total } = { total: 0 }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(shopArtistApplicationWork)
        .where(eq(shopArtistApplicationWork.applicationId, id));
      await db
        .insert(shopArtistApplicationWork)
        .values({ applicationId: id, position: total, mediaKey });
      await db.update(shopArtistApplication).set(bump).where(eq(shopArtistApplication.id, id));
    },

    async setState(id, patch) {
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ) as Partial<ApplicationRow>;
      await db
        .update(shopArtistApplication)
        .set({ ...defined, ...bump })
        .where(eq(shopArtistApplication.id, id));
    },

    async appendEvent(event) {
      await db.insert(shopArtistApplicationEvent).values({
        applicationId: event.applicationId,
        action: event.action,
        actorSubjectId: event.actorSubjectId,
        message: event.message ?? null,
        assigneeSubject: event.assigneeSubject ?? null,
      });
    },
  };
}
