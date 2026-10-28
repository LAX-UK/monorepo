import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtistApplication,
  shopArtistApplicationEvent,
  shopArtistApplicationWork,
  shopMediaAsset,
  shopStaffMember,
  shopUserProfile,
} from "@auction/db/schema";
import type {
  AdminArtistApplicationListItem,
  ArtistApplicationQueueView,
  ArtistApplicationReviewer,
} from "@auction/shop-contracts";
import type { ArtistApplicationStatus } from "@auction/shop-domain";
import { type SQL, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  ArtistApplicationQueueCursor,
  ArtistApplicationQueueFilters,
  ArtistApplicationQueueReader,
} from "../../application/artist-applications/artist-application.ports.js";
import { containsPattern } from "../drizzle-editorial-search.reader.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** The statuses behind each built-in view. Drafts belong to the artist and are never listed. */
export const QUEUE_VIEW_STATUSES: Readonly<
  Record<ArtistApplicationQueueView, readonly ArtistApplicationStatus[]>
> = {
  all: ["submitted", "in_review", "more_info_needed", "accepted", "declined"],
  new: ["submitted"],
  in_review: ["in_review"],
  waiting: ["more_info_needed"],
  decided: ["accepted", "declined"],
};

const VIEWS = Object.keys(QUEUE_VIEW_STATUSES) as ArtistApplicationQueueView[];

type QueueRow = {
  id: string;
  reference: string;
  status: ArtistApplicationStatus;
  artist_name: string | null;
  location: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  assignee_subject: string | null;
  assignee_label: string | null;
  assignee_role: string | null;
  work_count: number;
  cover_key: string | null;
  submitted_at: Date | string;
  cursor_at: string;
  version: number;
};

const SOURCE = sql`
  FROM shop_artist_application a
  LEFT JOIN shop_user_profile up ON up.identity_subject_id = a.applicant_subject_id
  LEFT JOIN shop_user_profile rp ON rp.identity_subject_id = a.assignee_subject
  LEFT JOIN shop_staff_member rs ON rs.identity_subject_id = a.assignee_subject
`;

const COLUMNS = sql`
  a.id, a.reference, a.status::text AS status, a.artist_name, a.location,
  up.name AS applicant_name, coalesce(a.contact_email, up.email) AS applicant_email,
  a.assignee_subject, coalesce(rp.name, rp.email) AS assignee_label, rs.role::text AS assignee_role,
  (SELECT count(*)::int FROM shop_artist_application_work w WHERE w.application_id = a.id) AS work_count,
  (SELECT w.media_key FROM shop_artist_application_work w WHERE w.application_id = a.id
    ORDER BY w.position LIMIT 1) AS cover_key,
  a.submitted_at,
  to_char(a.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
  a.version
`;

function statusIn(statuses: readonly ArtistApplicationStatus[]): SQL {
  return sql`a.status::text IN (${sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  )})`;
}

/** Every filter except the view, so the view counts add up under the same search. */
function filterConditions(filters: ArtistApplicationQueueFilters): SQL[] {
  const conditions: SQL[] = [statusIn(QUEUE_VIEW_STATUSES.all)];
  if (filters.assignee?.type === "unassigned") conditions.push(sql`a.assignee_subject IS NULL`);
  if (filters.assignee?.type === "subject") {
    conditions.push(sql`a.assignee_subject = ${filters.assignee.subject}`);
  }
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    conditions.push(
      sql`(a.artist_name ILIKE ${pattern} OR a.location ILIKE ${pattern} OR a.reference ILIKE ${pattern}
        OR coalesce(a.contact_email, up.email) ILIKE ${pattern})`,
    );
  }
  return conditions;
}

function cursorCondition(cursor: ArtistApplicationQueueCursor, ascending: boolean): SQL {
  return ascending
    ? sql`(a.submitted_at, a.id) > (${cursor.submittedAt}::timestamptz, ${cursor.id}::uuid)`
    : sql`(a.submitted_at, a.id) < (${cursor.submittedAt}::timestamptz, ${cursor.id}::uuid)`;
}

const where = (conditions: SQL[]) => sql`WHERE ${sql.join(conditions, sql` AND `)}`;

/** Staff's view of sent applications: the queue, the counts per view, and one record. */
export function createDrizzleArtistApplicationQueueReader(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): ArtistApplicationQueueReader {
  const { resolveMediaUrl } = options;

  async function people(
    subjects: readonly string[],
  ): Promise<Map<string, ArtistApplicationReviewer>> {
    const unique = [...new Set(subjects)];
    if (unique.length === 0) return new Map();
    const found = await db
      .select({
        subject: shopUserProfile.identitySubjectId,
        name: shopUserProfile.name,
        email: shopUserProfile.email,
        role: shopStaffMember.role,
      })
      .from(shopUserProfile)
      .leftJoin(
        shopStaffMember,
        eq(shopStaffMember.identitySubjectId, shopUserProfile.identitySubjectId),
      )
      .where(inArray(shopUserProfile.identitySubjectId, unique));
    const bySubject = new Map(found.map((row) => [row.subject, row]));
    return new Map(
      unique.map((subject) => {
        const row = bySubject.get(subject);
        return [
          subject,
          {
            subject,
            label: row?.name?.trim() || row?.email?.trim() || null,
            role: row?.role ?? null,
          },
        ];
      }),
    );
  }

  return {
    async list({ filters, cursor, limit, sort }) {
      const ascending = sort === "submitted_asc";
      const base = filterConditions(filters);
      const page = [...base, statusIn(QUEUE_VIEW_STATUSES[filters.view])];
      if (cursor) page.push(cursorCondition(cursor, ascending));
      const found = (
        await db.execute(sql`
          SELECT ${COLUMNS} ${SOURCE} ${where(page)}
          ORDER BY a.submitted_at ${ascending ? sql`ASC` : sql`DESC`}, a.id ${ascending ? sql`ASC` : sql`DESC`}
          LIMIT ${limit + 1}
        `)
      ).rows as QueueRow[];
      const rows = found.slice(0, limit);
      const last = rows.at(-1);

      const totals = (
        await db.execute(
          sql`SELECT a.status::text AS status, count(*)::int AS total ${SOURCE} ${where(base)} GROUP BY a.status`,
        )
      ).rows as Array<{ status: ArtistApplicationStatus; total: number }>;
      const counts = Object.fromEntries(
        VIEWS.map((view) => [
          view,
          totals
            .filter((row) => QUEUE_VIEW_STATUSES[view].includes(row.status))
            .reduce((sum, row) => sum + Number(row.total), 0),
        ]),
      ) as Record<ArtistApplicationQueueView, number>;

      const items: AdminArtistApplicationListItem[] = rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
        artistName: row.artist_name,
        location: row.location,
        applicant: { name: row.applicant_name, email: row.applicant_email },
        assignee: row.assignee_subject
          ? { subject: row.assignee_subject, label: row.assignee_label, role: row.assignee_role }
          : null,
        workCount: Number(row.work_count),
        coverImageUrl: resolveMediaUrl(row.cover_key),
        submittedAt: new Date(row.submitted_at).toISOString(),
        version: Number(row.version),
      }));
      return {
        items,
        counts,
        nextCursor:
          found.length > limit && last ? { submittedAt: last.cursor_at, id: last.id } : null,
      };
    },

    async countNew() {
      const [row] = (
        await db.execute(
          sql`SELECT count(*)::int AS total FROM shop_artist_application WHERE status = 'submitted'`,
        )
      ).rows as Array<{ total: number }>;
      return Number(row?.total ?? 0);
    },

    async getDetail(id) {
      const [application] = await db
        .select()
        .from(shopArtistApplication)
        .where(eq(shopArtistApplication.id, id))
        .limit(1);
      if (!application || application.status === "draft" || !application.submittedAt) return null;

      const [works, events, artist] = await Promise.all([
        db
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
          .where(eq(shopArtistApplicationWork.applicationId, id))
          .orderBy(asc(shopArtistApplicationWork.position)),
        db
          .select()
          .from(shopArtistApplicationEvent)
          .where(eq(shopArtistApplicationEvent.applicationId, id))
          .orderBy(asc(shopArtistApplicationEvent.createdAt), asc(shopArtistApplicationEvent.id)),
        application.artistId
          ? db
              .select({ id: shopArtist.id, slug: shopArtist.slug })
              .from(shopArtist)
              .where(eq(shopArtist.id, application.artistId))
              .limit(1)
          : Promise.resolve([]),
      ]);

      const staffSubjects = [
        ...(application.assigneeSubject ? [application.assigneeSubject] : []),
        ...events
          .filter((event) => event.actorSubjectId !== application.applicantSubjectId)
          .map((event) => event.actorSubjectId),
        ...events.flatMap((event) => (event.assigneeSubject ? [event.assigneeSubject] : [])),
        application.applicantSubjectId,
      ];
      const directory = await people(staffSubjects);
      const applicant = directory.get(application.applicantSubjectId);
      const person = (subject: string | null) =>
        subject ? (directory.get(subject) ?? null) : null;

      return {
        id: application.id,
        reference: application.reference,
        status: application.status,
        applicant: {
          subject: application.applicantSubjectId,
          name:
            applicant?.label && applicant.label !== application.contactEmail
              ? applicant.label
              : null,
          email: application.contactEmail,
        },
        assignee: person(application.assigneeSubject),
        artistName: application.artistName,
        location: application.location,
        website: application.website,
        socialLinks: application.socialLinks,
        shortBio: application.shortBio,
        statement: application.statement,
        representation: application.representation,
        exhibitions: application.exhibitions,
        works: works.map((work) => ({
          mediaKey: work.mediaKey,
          imageUrl: resolveMediaUrl(work.mediaKey),
          width: work.width,
          height: work.height,
          title: work.title,
          year: work.year,
          medium: work.medium,
          size: work.size,
          kind: work.kind,
        })),
        messageToArtist: application.messageToArtist,
        artist: artist[0] ?? null,
        events: events.map((event) => {
          const byApplicant = event.actorSubjectId === application.applicantSubjectId;
          return {
            id: event.id,
            action: event.action,
            actor: {
              kind: byApplicant ? ("applicant" as const) : ("staff" as const),
              person: byApplicant ? null : person(event.actorSubjectId),
            },
            message: event.message,
            assignee: person(event.assigneeSubject),
            createdAt: event.createdAt.toISOString(),
          };
        }),
        submittedAt: application.submittedAt.toISOString(),
        decidedAt: application.decidedAt?.toISOString() ?? null,
        version: application.version,
      };
    },
  };
}
