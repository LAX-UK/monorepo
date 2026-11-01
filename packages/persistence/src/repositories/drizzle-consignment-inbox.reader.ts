import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  consignmentMessage,
  consignmentMessageAttachment,
  consignmentThread,
  itemSubmission,
  legalEntity,
  lot,
  sale,
} from "@auction/db/schema";
import {
  type ConsignmentInboxSort,
  type ConsignmentMessageSide,
  accountSearchTerms,
} from "@auction/domain";
import {
  type SQL,
  type SQLWrapper,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  ConsignmentInboxFacetRecord,
  ConsignmentInboxFacetsRecord,
  ConsignmentInboxQueryFilter,
  ConsignmentInboxRowRecord,
  ConsignmentInboxSummaryRecord,
  IConsignmentInboxReader,
} from "../interfaces/consignment-inbox.reader.js";

const specialistDirectory = alias(bidIdentityDirectory, "inbox_specialist_directory");
const coveringDirectory = alias(bidIdentityDirectory, "inbox_covering_directory");
const submitterDirectory = alias(bidIdentityDirectory, "inbox_submitter_directory");

type Facet = "specialist" | "sale" | "organisation";

export const UNASSIGNED_FACET_ID = "unassigned";
export const NO_SALE_FACET_ID = "none";
export const PRIVATE_SELLERS_FACET_ID = "private";

/** Search text as a `like` pattern that matches it literally. */
function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** The person who has the thread: whoever covers it, else the consignment's specialist. */
const assigneeId = sql<
  string | null
>`coalesce(${consignmentThread.coveringUserId}, ${itemSubmission.assignedToUserId})`;

const threadHasMessages = sql`exists (
  select 1 from ${consignmentMessage}
  where ${consignmentMessage.threadId} = ${consignmentThread.id}
)`;

const isOpen = sql`${consignmentThread.closedAt} is null`;
const waitsOnStaff = sql`${consignmentThread.lastMessageSide} = 'client'`;

/**
 * Reads across threads for the inbox. The list, its counts and the facets all read one filtered
 * subquery, so they cannot disagree about which threads match.
 */
export class DrizzleConsignmentInboxReader implements IConsignmentInboxReader {
  constructor(private readonly db: Database) {}

  async list(input: {
    filter: ConsignmentInboxQueryFilter;
    sort: ConsignmentInboxSort;
    limit: number;
    offset: number;
  }): Promise<{ rows: ConsignmentInboxRowRecord[]; total: number }> {
    const base = this.base(input.filter);
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(base)
        .orderBy(...this.order(base, input.sort))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(base),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    if (rows.length === 0) return { rows: [], total };
    const lastMessages = await this.lastMessages(rows.map((row) => row.threadId));
    return {
      total,
      rows: rows.flatMap((row): ConsignmentInboxRowRecord[] => {
        const last = lastMessages.get(row.threadId);
        if (!last) return [];
        return [
          {
            submissionId: row.submissionId,
            title: row.title,
            referenceNumber: row.referenceNumber,
            image: row.image,
            sale: row.saleId && row.saleName ? { id: row.saleId, name: row.saleName } : null,
            account:
              row.accountId && row.accountName && row.accountKind
                ? { id: row.accountId, name: row.accountName, kind: row.accountKind }
                : null,
            clientPersonName: row.clientPersonName ?? row.submitterName,
            closedAt: row.closedAt,
            awaitingSince: row.awaitingSince,
            lastMessage: last,
            lastMessageSide: row.lastMessageSide as ConsignmentMessageSide,
            unreadFromClient: Number(row.unreadFromClient ?? 0),
            specialist: row.specialistId
              ? { userId: row.specialistId, name: row.specialistName ?? "A colleague" }
              : null,
            covering: row.coveringId
              ? { userId: row.coveringId, name: row.coveringName ?? "A colleague" }
              : null,
          },
        ];
      }),
    };
  }

  async facets(filter: ConsignmentInboxQueryFilter): Promise<ConsignmentInboxFacetsRecord> {
    const [specialist, saleFacet, organisation] = await Promise.all([
      this.facet(filter, "specialist"),
      this.facet(filter, "sale"),
      this.facet(filter, "organisation"),
    ]);
    return { specialist, sale: saleFacet, organisation };
  }

  async summary(viewerUserId: string): Promise<ConsignmentInboxSummaryRecord> {
    const waitingOpen = and(isOpen, waitsOnStaff, threadHasMessages);
    const [totals, mine] = await Promise.all([
      this.db
        .select({
          unanswered: sql<number>`count(*) filter (where ${waitingOpen})::int`,
          unassignedWaiting: sql<number>`count(*) filter (where ${waitingOpen} and ${assigneeId} is null)::int`,
          unassignedOldest: sql<Date | null>`min(${consignmentThread.awaitingSince}) filter (where ${waitingOpen} and ${assigneeId} is null)`,
          unassignedOldestAccount: sql<
            string | null
          >`(array_agg(${legalEntity.displayName} order by ${consignmentThread.awaitingSince} asc nulls last) filter (where ${waitingOpen} and ${assigneeId} is null))[1]`,
        })
        .from(consignmentThread)
        .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
        .leftJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId)),
      this.db
        .select({ since: consignmentThread.awaitingSince })
        .from(consignmentThread)
        .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
        .where(
          and(
            waitingOpen,
            sql`${consignmentThread.awaitingSince} is not null`,
            sql`${assigneeId} = ${viewerUserId}`,
          ),
        ),
    ]);
    const row = totals[0];
    const oldest = row?.unassignedOldest ? new Date(row.unassignedOldest) : null;
    return {
      unanswered: Number(row?.unanswered ?? 0),
      mineWaitingSince: mine.flatMap((m) => (m.since ? [m.since] : [])),
      unassignedWaiting: Number(row?.unassignedWaiting ?? 0),
      unassignedOldestWaitingSince: oldest,
      unassignedOldestAccountName: row?.unassignedOldestAccount ?? null,
    };
  }

  async findSubmissionIds(filter: ConsignmentInboxQueryFilter, limit: number): Promise<string[]> {
    const base = this.base(filter);
    const rows = await this.db
      .select({ submissionId: base.submissionId })
      .from(base)
      .orderBy(desc(base.lastMessageAt), desc(base.submissionId))
      .limit(limit);
    return rows.map((row) => row.submissionId);
  }

  async openThreadCounts(userIds: readonly string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .select({ userId: assigneeId, count: sql<number>`count(*)::int` })
      .from(consignmentThread)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
      .where(and(isOpen, threadHasMessages, inArray(assigneeId, [...userIds])))
      .groupBy(assigneeId);
    return new Map(rows.flatMap((row) => (row.userId ? [[row.userId, Number(row.count)]] : [])));
  }

  /** The threads a filter matches, with the columns the list, the facets and the sorts read. */
  private base(filter: ConsignmentInboxQueryFilter, skip?: Facet) {
    return this.db
      .select({
        threadId: consignmentThread.id,
        submissionId: itemSubmission.id,
        title: itemSubmission.title,
        referenceNumber: itemSubmission.referenceNumber,
        image: sql<string | null>`(${itemSubmission.images})[1]`.as("image"),
        accountId: legalEntity.id,
        accountName: legalEntity.displayName,
        accountKind: legalEntity.kind,
        organisationKey:
          sql<string>`case when ${legalEntity.kind} = 'individual' then ${PRIVATE_SELLERS_FACET_ID} else ${legalEntity.id}::text end`.as(
            "organisation_key",
          ),
        saleId: lot.saleId,
        saleName: sale.title,
        saleStartsAt: sale.startTime,
        assigneeId: assigneeId.as("assignee_id"),
        assigneeName: sql<
          string | null
        >`coalesce(${coveringDirectory.name}, ${specialistDirectory.name})`.as("assignee_name"),
        specialistId: itemSubmission.assignedToUserId,
        specialistName: specialistDirectory.name,
        coveringId: consignmentThread.coveringUserId,
        coveringName: coveringDirectory.name,
        closedAt: consignmentThread.closedAt,
        awaitingSince: consignmentThread.awaitingSince,
        lastMessageAt: consignmentThread.lastMessageAt,
        lastMessageSide: consignmentThread.lastMessageSide,
        submitterName: submitterDirectory.name,
        clientPersonName: sql<string | null>`(
          select ${bidIdentityDirectory.name}
          from ${consignmentMessage}
          left join ${bidIdentityDirectory}
            on ${bidIdentityDirectory.subjectId} = ${consignmentMessage.authorUserId}
          where ${consignmentMessage.threadId} = ${consignmentThread.id}
            and ${consignmentMessage.authorSide} = 'client'
          order by ${consignmentMessage.createdAt} desc
          limit 1
        )`.as("client_person_name"),
        unreadFromClient: sql<number>`(
          select count(*)::int from ${consignmentMessage}
          where ${consignmentMessage.threadId} = ${consignmentThread.id}
            and ${consignmentMessage.authorSide} = 'client'
            and ${consignmentMessage.readAt} is null
        )`.as("unread_from_client"),
      })
      .from(consignmentThread)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
      .leftJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .leftJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(
        specialistDirectory,
        eq(specialistDirectory.subjectId, itemSubmission.assignedToUserId),
      )
      .leftJoin(
        coveringDirectory,
        eq(coveringDirectory.subjectId, consignmentThread.coveringUserId),
      )
      .leftJoin(
        submitterDirectory,
        eq(submitterDirectory.subjectId, itemSubmission.submittedByUserId),
      )
      .where(and(threadHasMessages, ...this.conditions(filter, skip)))
      .as("inbox_base");
  }

  private order(
    base: ReturnType<DrizzleConsignmentInboxReader["base"]>,
    sort: ConsignmentInboxSort,
  ) {
    const tieBreak = desc(base.submissionId);
    switch (sort) {
      case "waiting":
        return [
          sql`${base.awaitingSince} asc nulls last`,
          desc(base.lastMessageAt),
          tieBreak,
        ] as const;
      case "oldest":
        return [asc(base.lastMessageAt), tieBreak] as const;
      case "sale_date":
        return [
          sql`${base.saleStartsAt} asc nulls last`,
          desc(base.lastMessageAt),
          tieBreak,
        ] as const;
      default:
        return [desc(base.lastMessageAt), tieBreak] as const;
    }
  }

  /** The conditions a filter means; the faceted one is left out when counting its own choices. */
  private conditions(filter: ConsignmentInboxQueryFilter, skip?: Facet): SQL[] {
    const conditions: SQL[] = [];
    switch (filter.view) {
      case "unanswered":
        conditions.push(sql`${isOpen} and ${waitsOnStaff}`);
        break;
      case "mine":
        conditions.push(sql`${isOpen} and ${assigneeId} = ${filter.viewerUserId}`);
        break;
      case "closed":
        conditions.push(sql`${consignmentThread.closedAt} is not null`);
        break;
      default:
        break;
    }
    const q = filter.q?.trim();
    if (q) conditions.push(this.search(q));
    if (skip !== "specialist" && filter.specialist?.length) {
      const wantsNone = filter.specialist.includes(UNASSIGNED_FACET_ID);
      const ids = filter.specialist.filter((id) => id !== UNASSIGNED_FACET_ID);
      const either = or(
        ids.length > 0 ? inArray(assigneeId, ids) : undefined,
        wantsNone ? sql`${assigneeId} is null` : undefined,
      );
      if (either) conditions.push(either);
    }
    if (skip !== "sale" && filter.sale?.length) {
      const wantsNone = filter.sale.includes(NO_SALE_FACET_ID);
      const ids = filter.sale.filter((id) => id !== NO_SALE_FACET_ID);
      const either = or(
        ids.length > 0 ? inArray(lot.saleId, ids) : undefined,
        wantsNone ? isNull(lot.saleId) : undefined,
      );
      if (either) conditions.push(either);
    }
    if (skip !== "organisation" && filter.organisation?.length) {
      const wantsPrivate = filter.organisation.includes(PRIVATE_SELLERS_FACET_ID);
      const ids = filter.organisation.filter((id) => id !== PRIVATE_SELLERS_FACET_ID);
      const either = or(
        ids.length > 0 ? inArray(legalEntity.id, ids) : undefined,
        wantsPrivate ? eq(legalEntity.kind, "individual") : undefined,
      );
      if (either) conditions.push(either);
    }
    return conditions;
  }

  /** Reference, work title, account, the people who wrote or sent it, and words in any message. */
  private search(q: string): SQL {
    const pattern = containing(q);
    const like = (column: SQLWrapper) => sql`${column} ilike ${pattern} escape '\\'`;
    const terms = accountSearchTerms(q);
    const matches = or(
      terms?.consignmentNumber != null
        ? eq(itemSubmission.referenceNumber, terms.consignmentNumber)
        : undefined,
      like(itemSubmission.title),
      like(legalEntity.displayName),
      sql`exists (
        select 1 from ${bidIdentityDirectory}
        where ${bidIdentityDirectory.subjectId} = ${itemSubmission.submittedByUserId}
          and ${like(bidIdentityDirectory.name)}
      )`,
      sql`exists (
        select 1 from ${consignmentMessage}
        left join ${bidIdentityDirectory}
          on ${bidIdentityDirectory.subjectId} = ${consignmentMessage.authorUserId}
        where ${consignmentMessage.threadId} = ${consignmentThread.id}
          and (${like(consignmentMessage.body)} or ${like(bidIdentityDirectory.name)})
      )`,
    );
    if (!matches) throw new Error("search has no conditions");
    return matches;
  }

  /** The newest message of each thread: a reply or client message first, else the newest note. */
  private async lastMessages(threadIds: readonly string[]) {
    const authorDirectory = alias(bidIdentityDirectory, "inbox_message_author");
    const rows = await this.db
      .selectDistinctOn([consignmentMessage.threadId], {
        threadId: consignmentMessage.threadId,
        side: consignmentMessage.authorSide,
        body: consignmentMessage.body,
        authorName: authorDirectory.name,
        at: consignmentMessage.createdAt,
        hasAttachment: sql<boolean>`exists (
          select 1 from ${consignmentMessageAttachment}
          where ${consignmentMessageAttachment.messageId} = ${consignmentMessage.id}
        )`,
      })
      .from(consignmentMessage)
      .leftJoin(authorDirectory, eq(authorDirectory.subjectId, consignmentMessage.authorUserId))
      .where(inArray(consignmentMessage.threadId, [...threadIds]))
      .orderBy(
        consignmentMessage.threadId,
        sql`(${consignmentMessage.visibility} = 'thread') desc`,
        desc(consignmentMessage.createdAt),
        desc(consignmentMessage.id),
      );
    return new Map(
      rows.map((row) => [
        row.threadId,
        {
          side: row.side as ConsignmentMessageSide,
          authorName: row.authorName ?? null,
          body: row.body,
          hasAttachment: row.hasAttachment,
          at: row.at,
        },
      ]),
    );
  }

  private async facet(
    filter: ConsignmentInboxQueryFilter,
    facet: Facet,
  ): Promise<ConsignmentInboxFacetRecord[]> {
    const base = this.base(filter, facet);
    const count = sql<number>`count(*)::int`;
    let facets: ConsignmentInboxFacetRecord[];
    if (facet === "specialist") {
      const rows = await this.db
        .select({ id: base.assigneeId, name: base.assigneeName, count })
        .from(base)
        .groupBy(base.assigneeId, base.assigneeName);
      facets = rows.map((row) => ({
        id: row.id ?? UNASSIGNED_FACET_ID,
        label: row.id ? (row.name ?? "A colleague") : "Unassigned",
        count: Number(row.count),
      }));
    } else if (facet === "sale") {
      const rows = await this.db
        .select({ id: base.saleId, name: base.saleName, count })
        .from(base)
        .groupBy(base.saleId, base.saleName);
      facets = rows.map((row) => ({
        id: row.id ?? NO_SALE_FACET_ID,
        label: row.id ? (row.name ?? "A sale") : "Not in a sale",
        count: Number(row.count),
      }));
    } else {
      const rows = await this.db
        .select({ id: base.organisationKey, name: base.accountName, count })
        .from(base)
        .groupBy(base.organisationKey, base.accountName);
      // Every private seller shares one choice, whatever their names.
      const merged = new Map<string, ConsignmentInboxFacetRecord>();
      for (const row of rows) {
        const isPrivate = row.id === PRIVATE_SELLERS_FACET_ID;
        const existing = merged.get(row.id);
        merged.set(row.id, {
          id: row.id,
          label: isPrivate ? "Private sellers" : (row.name ?? "An organisation"),
          count: (existing?.count ?? 0) + Number(row.count),
        });
      }
      facets = [...merged.values()];
    }
    return facets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
}
