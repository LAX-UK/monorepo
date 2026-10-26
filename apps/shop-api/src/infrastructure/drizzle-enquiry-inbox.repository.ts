import type { Database } from "@auction/db";
import { shopEnquiryNote, shopStaffMember, shopUserProfile } from "@auction/db/schema";
import type {
  AdminEnquiryDetail,
  AdminEnquiryListItem,
  EnquiryAssignee,
  EnquiryKind,
  EnquiryListSort,
  EnquiryStatus,
  EnquiryTopic,
} from "@auction/shop-contracts";
import { roleHasCapability } from "@auction/shop-domain";
import { type SQL, and, asc, eq, isNull, sql } from "drizzle-orm";
import type { EnquiryInboxCursor } from "../application/enquiry-inbox-cursor.js";
import type {
  EnquiryInboxFilters,
  EnquiryInboxRepository,
} from "../application/ports/enquiry-inbox.repository.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** A drizzle database or an open transaction on it. */
type Executor = Pick<Database, "select" | "insert" | "update" | "execute">;

/** What each kind is stored in. Only these constants are ever spliced into SQL as identifiers. */
const TABLES = {
  general: { name: "shop_general_enquiry", ident: sql.identifier("shop_general_enquiry") },
  artwork: { name: "shop_artwork_interest", ident: sql.identifier("shop_artwork_interest") },
} as const;

/** Notify-me signups share shop_artwork_interest; only `enquiry` rows are enquiries. */
function onlyEnquiries(kind: EnquiryKind): SQL {
  return kind === "artwork" ? sql` AND intent = 'enquiry'` : sql``;
}

const EXCERPT_LENGTH = 160;

/**
 * `timestamptz` rendered by the database at microsecond precision. Used for cursors and
 * versions: a JavaScript Date keeps only milliseconds, so comparing against one could match
 * the wrong row, or none.
 */
const microIso = (column: SQL): SQL =>
  sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** Both tables as one relation, so filtering, search and paging are written once. */
const INBOX_UNION = sql`
  SELECT 'general'::text AS kind, g.id, g.topic::text AS topic, g.status::text AS status,
    g.assignee_subject, g.identity_subject_id AS sender_subject, g.contact_name, g.contact_email,
    g.phone, g.message, g.created_at, g.updated_at, g.closed_at, g.context_slug,
    NULL::uuid AS artwork_id
  FROM shop_general_enquiry g
  UNION ALL
  SELECT 'artwork'::text, a.id, 'artwork'::text, a.status::text, a.assignee_subject,
    a.identity_subject_id, a.contact_name, a.contact_email, a.contact_phone,
    coalesce(a.message, ''), a.created_at, a.updated_at, a.closed_at, NULL::text, a.artwork_id
  FROM shop_artwork_interest a
  WHERE a.intent = 'enquiry'
`;

/** The union plus everything a row needs from other tables. */
const INBOX_SOURCE = sql`
  FROM (${INBOX_UNION}) e
  LEFT JOIN shop_user_profile sp ON sp.identity_subject_id = e.sender_subject
  LEFT JOIN shop_user_profile ap ON ap.identity_subject_id = e.assignee_subject
  LEFT JOIN shop_staff_member asm ON asm.identity_subject_id = e.assignee_subject
  LEFT JOIN shop_artwork w ON w.id = e.artwork_id
`;

const SENDER_NAME = sql`coalesce(e.contact_name, sp.name)`;
const SENDER_EMAIL = sql`coalesce(e.contact_email, sp.email)`;

type InboxRow = {
  kind: EnquiryKind;
  id: string;
  topic: EnquiryTopic;
  status: EnquiryStatus;
  assignee_subject: string | null;
  assignee_label: string | null;
  assignee_role: string | null;
  sender_subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  phone: string | null;
  message: string;
  created_at: Date;
  closed_at: Date | null;
  context_slug: string | null;
  artwork_id: string | null;
  artwork_title: string | null;
  artwork_slug: string | null;
  artwork_image: string | null;
  cursor_at: string;
  version: string;
};

const ROW_COLUMNS = sql`
  e.kind, e.id, e.topic, e.status, e.assignee_subject, coalesce(ap.name, ap.email) AS assignee_label,
  asm.role::text AS assignee_role,
  e.sender_subject, ${SENDER_NAME} AS sender_name, ${SENDER_EMAIL} AS sender_email, e.phone,
  e.created_at, e.closed_at, e.context_slug, e.artwork_id, w.title AS artwork_title,
  w.slug AS artwork_slug, w.primary_image_url AS artwork_image,
  ${microIso(sql`e.created_at`)} AS cursor_at, ${microIso(sql`e.updated_at`)} AS version
`;

function whereClause(conditions: SQL[]): SQL {
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
}

/** Every filter except `status`, which the list applies itself so the counts can ignore it. */
function filterConditions(filters: EnquiryInboxFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.kind) conditions.push(sql`e.kind = ${filters.kind}`);
  if (filters.topic) conditions.push(sql`e.topic = ${filters.topic}`);
  if (filters.assignee?.type === "unassigned") conditions.push(sql`e.assignee_subject IS NULL`);
  if (filters.assignee?.type === "subject") {
    conditions.push(sql`e.assignee_subject = ${filters.assignee.subject}`);
  }
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    conditions.push(
      sql`(${SENDER_NAME} ILIKE ${pattern} OR ${SENDER_EMAIL} ILIKE ${pattern} OR e.message ILIKE ${pattern})`,
    );
  }
  return conditions;
}

/**
 * Rows after the cursor in the list order: waiting (`new`) rows first, then the sort within each
 * group. After a waiting row come later waiting rows and then every other status; after any
 * other row, only later rows of the same group.
 */
function cursorCondition(cursor: EnquiryInboxCursor, sort: EnquiryListSort): SQL {
  const after =
    sort === "received_asc"
      ? sql`(e.created_at, e.kind, e.id) > (${cursor.createdAt}::timestamptz, ${cursor.kind}, ${cursor.id}::uuid)`
      : sql`(e.created_at, e.kind, e.id) < (${cursor.createdAt}::timestamptz, ${cursor.kind}, ${cursor.id}::uuid)`;
  return cursor.waiting
    ? sql`(e.status <> 'new' OR ${after})`
    : sql`(e.status <> 'new' AND ${after})`;
}

function orderClause(sort: EnquiryListSort): SQL {
  return sort === "received_asc"
    ? sql`ORDER BY (e.status = 'new') DESC, e.created_at ASC, e.kind ASC, e.id ASC`
    : sql`ORDER BY (e.status = 'new') DESC, e.created_at DESC, e.kind DESC, e.id DESC`;
}

function excerpt(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : flat;
}

export function createDrizzleEnquiryInboxRepository(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): EnquiryInboxRepository {
  const { resolveMediaUrl } = options;

  const rows = async <T>(executor: Executor, query: SQL): Promise<T[]> =>
    (await executor.execute(query)).rows as T[];

  const toSender = (row: InboxRow) => ({
    type: row.sender_subject ? ("member" as const) : ("guest" as const),
    name: row.sender_name,
    email: row.sender_email,
  });
  const toAssignee = (row: InboxRow) =>
    row.assignee_subject
      ? { subject: row.assignee_subject, label: row.assignee_label, role: row.assignee_role }
      : null;
  const toArtwork = (row: InboxRow) =>
    row.artwork_id && row.artwork_title && row.artwork_slug
      ? {
          id: row.artwork_id,
          title: row.artwork_title,
          slug: row.artwork_slug,
          thumbnailUrl: resolveMediaUrl(row.artwork_image),
        }
      : null;

  async function staffIdentity(executor: Executor, subject: string): Promise<EnquiryAssignee> {
    const [member] = await executor
      .select({
        role: shopStaffMember.role,
        name: shopUserProfile.name,
        email: shopUserProfile.email,
      })
      .from(shopStaffMember)
      .leftJoin(
        shopUserProfile,
        eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
      )
      .where(eq(shopStaffMember.identitySubjectId, subject))
      .limit(1);
    return {
      subject,
      label: member?.name?.trim() || member?.email?.trim() || null,
      role: member?.role ?? null,
    };
  }

  return {
    async list({ filters, cursor, limit, sort = "received_desc" }) {
      const base = filterConditions(filters);
      const pageConditions = [...base];
      if (filters.status) pageConditions.push(sql`e.status = ${filters.status}`);
      if (cursor) pageConditions.push(cursorCondition(cursor, sort));

      // One extra row tells us whether another page exists without a count query.
      const found = await rows<InboxRow & { message: string }>(
        db,
        sql`
          SELECT ${ROW_COLUMNS}, left(e.message, 400) AS message
          ${INBOX_SOURCE}
          ${whereClause(pageConditions)}
          ${orderClause(sort)}
          LIMIT ${limit + 1}
        `,
      );
      const page = found.slice(0, limit);
      const last = page.at(-1);

      const countRows = await rows<{ status: EnquiryStatus; total: string }>(
        db,
        sql`SELECT e.status, count(*) AS total ${INBOX_SOURCE} ${whereClause(base)} GROUP BY e.status`,
      );
      const counts = { new: 0, in_progress: 0, closed: 0 };
      for (const row of countRows) counts[row.status] = Number(row.total);

      const items: AdminEnquiryListItem[] = page.map((row) => ({
        kind: row.kind,
        id: row.id,
        topic: row.topic,
        status: row.status,
        assignee: toAssignee(row),
        sender: toSender(row),
        artwork: toArtwork(row),
        excerpt: excerpt(row.message),
        version: row.version,
        createdAt: new Date(row.created_at).toISOString(),
      }));
      return {
        items,
        counts,
        nextCursor:
          found.length > limit && last
            ? {
                waiting: last.status === "new",
                createdAt: last.cursor_at,
                kind: last.kind,
                id: last.id,
              }
            : null,
      };
    },

    async summary() {
      const [row] = await rows<{ new_count: string; attention_count: string }>(
        db,
        sql`
          SELECT count(*) FILTER (WHERE e.status = 'new') AS new_count,
            count(*) FILTER (WHERE e.status = 'new' AND e.assignee_subject IS NULL) AS attention_count
          FROM (${INBOX_UNION}) e
        `,
      );
      return {
        newCount: Number(row?.new_count ?? 0),
        needsAttentionCount: Number(row?.attention_count ?? 0),
      };
    },

    async getDetail(kind, id) {
      const [row] = await rows<InboxRow>(
        db,
        sql`
          SELECT ${ROW_COLUMNS}, e.message
          ${INBOX_SOURCE}
          WHERE e.kind = ${kind} AND e.id = ${id}::uuid
        `,
      );
      if (!row) return null;

      const notes = await db
        .select({
          id: shopEnquiryNote.id,
          authorSubject: shopEnquiryNote.authorSubject,
          authorName: shopUserProfile.name,
          authorEmail: shopUserProfile.email,
          authorRole: shopStaffMember.role,
          body: shopEnquiryNote.body,
          createdAt: shopEnquiryNote.createdAt,
        })
        .from(shopEnquiryNote)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopEnquiryNote.authorSubject),
        )
        .leftJoin(
          shopStaffMember,
          eq(shopStaffMember.identitySubjectId, shopEnquiryNote.authorSubject),
        )
        .where(and(eq(shopEnquiryNote.enquiryKind, kind), eq(shopEnquiryNote.enquiryId, id)))
        .orderBy(asc(shopEnquiryNote.createdAt), asc(shopEnquiryNote.id));

      const detail: AdminEnquiryDetail = {
        kind: row.kind,
        id: row.id,
        topic: row.topic,
        status: row.status,
        assignee: toAssignee(row),
        sender: { ...toSender(row), phone: row.phone },
        artwork: toArtwork(row),
        contextSlug: row.context_slug,
        message: row.message,
        notes: notes.map((note) => ({
          id: note.id,
          author: {
            subject: note.authorSubject,
            label: note.authorName?.trim() || note.authorEmail?.trim() || null,
            role: note.authorRole ?? null,
          },
          body: note.body,
          createdAt: note.createdAt.toISOString(),
        })),
        createdAt: new Date(row.created_at).toISOString(),
        closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
        version: row.version,
      };
      return detail;
    },

    update(input) {
      const table = TABLES[input.kind];
      return db.transaction(async (tx) => {
        const [current] = await rows<{
          status: EnquiryStatus;
          assignee_subject: string | null;
          version: string;
        }>(
          tx,
          sql`
            SELECT status::text AS status, assignee_subject, ${microIso(sql`updated_at`)} AS version
            FROM ${table.ident}
            WHERE id = ${input.id}::uuid${onlyEnquiries(input.kind)}
            FOR UPDATE
          `,
        );
        if (!current) return { status: "not_found" };
        if (current.version !== input.expectedVersion) {
          return { status: "stale", currentVersion: current.version };
        }

        const nextStatus = input.status ?? current.status;
        const nextAssignee =
          input.assigneeSubject === undefined ? current.assignee_subject : input.assigneeSubject;
        if (nextStatus === current.status && nextAssignee === current.assignee_subject) {
          return { status: "updated", version: current.version };
        }

        const assignments: SQL[] = [
          sql`status = ${nextStatus}::shop_enquiry_status`,
          sql`assignee_subject = ${nextAssignee}`,
          sql`updated_at = now()`,
        ];
        // Stamp the close time once; keep it if the enquiry was already closed.
        if (nextStatus !== current.status) {
          assignments.push(
            nextStatus === "closed" ? sql`closed_at = now()` : sql`closed_at = NULL`,
          );
        }
        const [updated] = await rows<{ version: string }>(
          tx,
          sql`
            UPDATE ${table.ident}
            SET ${sql.join(assignments, sql`, `)}
            WHERE id = ${input.id}::uuid
            RETURNING ${microIso(sql`updated_at`)} AS version
          `,
        );
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: input.actorSubjectId,
          capability: "enquiry.write",
          action: "enquiry.update",
          targetType: table.name,
          targetId: input.id,
          beforeJson: { status: current.status, assigneeSubject: current.assignee_subject },
          afterJson: { status: nextStatus, assigneeSubject: nextAssignee },
        });
        return { status: "updated", version: updated?.version ?? current.version };
      });
    },

    addNote(input) {
      const table = TABLES[input.kind];
      return db.transaction(async (tx) => {
        const [exists] = await rows<{ id: string }>(
          tx,
          sql`SELECT id FROM ${table.ident} WHERE id = ${input.id}::uuid${onlyEnquiries(input.kind)}`,
        );
        if (!exists) return null;
        const [note] = await tx
          .insert(shopEnquiryNote)
          .values({
            enquiryKind: input.kind,
            enquiryId: input.id,
            authorSubject: input.authorSubjectId,
            body: input.body,
          })
          .returning();
        if (!note) return null;
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: input.authorSubjectId,
          capability: "enquiry.write",
          action: "enquiry.note.add",
          targetType: table.name,
          targetId: input.id,
          afterJson: { noteId: note.id },
        });
        return {
          id: note.id,
          author: await staffIdentity(tx, note.authorSubject),
          body: note.body,
          createdAt: note.createdAt.toISOString(),
        };
      });
    },

    async listAssignees() {
      const staff = await db
        .select({
          subject: shopStaffMember.identitySubjectId,
          role: shopStaffMember.role,
          name: shopUserProfile.name,
          email: shopUserProfile.email,
        })
        .from(shopStaffMember)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
        )
        .where(isNull(shopStaffMember.disabledAt));
      return staff
        .filter((member) => roleHasCapability(member.role, "enquiry.write"))
        .map((member) => ({
          subject: member.subject,
          label: member.name?.trim() || member.email?.trim() || null,
          role: member.role,
        }))
        .sort((a, b) => (a.label ?? a.subject).localeCompare(b.label ?? b.subject, "en-GB"));
    },
  };
}
