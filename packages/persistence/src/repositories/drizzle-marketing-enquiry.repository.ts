import type { Database } from "@auction/db";
import {
  marketingEnquiry,
  marketingEnquiryAttachment,
  privateSaleEnquiryDetail,
} from "@auction/db/schema";
import {
  OPEN_ENQUIRY_STATUSES,
  PRIVATE_SALE_ENQUIRY_INTENTS,
  enquiryViewCriteria,
} from "@auction/domain";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type {
  EnquiryListFilter,
  IMarketingEnquiryRepository,
  MarketingEnquiryChange,
  MarketingEnquiryDetailRecord,
  MarketingEnquiryRecord,
  MarketingEnquiryStatus,
  NewMarketingEnquiry,
  PrivateSaleEnquiryDetail,
} from "../interfaces/marketing-enquiry.repository.js";

const REFERENCE_PATTERN = /^E-\d{4,}$/;

function toRecord(row: typeof marketingEnquiry.$inferSelect): MarketingEnquiryRecord {
  return {
    id: row.id,
    reference: row.reference,
    intent: row.intent as MarketingEnquiryRecord["intent"],
    topic: row.topic,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    sourcePage: row.sourcePage,
    status: row.status as MarketingEnquiryStatus,
    closeReason: row.closeReason as MarketingEnquiryRecord["closeReason"],
    departmentSlug: row.departmentSlug,
    assignedToUserId: row.assignedToUserId,
    userId: row.userId,
    legalEntityId: row.legalEntityId,
    marketingOptIn: row.marketingOptIn,
    version: row.version,
    createdAt: row.createdAt,
    handledAt: row.handledAt,
    handledByUserId: row.handledByUserId,
  };
}

function toPrivateSaleDetail(
  row: typeof privateSaleEnquiryDetail.$inferSelect,
): PrivateSaleEnquiryDetail {
  return {
    artist: row.artist,
    title: row.title,
    medium: row.medium,
    size: row.size,
    locationTown: row.locationTown,
    locationCountry: row.locationCountry,
    priceInMindMinor: row.priceInMindMinor,
    lookingFor: row.lookingFor,
    budgetBand: row.budgetBand as PrivateSaleEnquiryDetail["budgetBand"],
    timing: row.timing as PrivateSaleEnquiryDetail["timing"],
    contactPreference: row.contactPreference as PrivateSaleEnquiryDetail["contactPreference"],
  };
}

/** What the viewer's capabilities let them see, as a condition on the enquiry table. */
function scopeCondition(scope: EnquiryListFilter["scope"]): SQL {
  const privateIntents = [...PRIVATE_SALE_ENQUIRY_INTENTS];
  const general = and(
    notInArray(marketingEnquiry.intent, privateIntents),
    scope.readsGeneral ? sql`true` : eq(marketingEnquiry.assignedToUserId, scope.viewerUserId),
  ) as SQL;
  if (!scope.readsPrivateSale) return general;
  return or(inArray(marketingEnquiry.intent, privateIntents), general) as SQL;
}

function viewConditions(filter: EnquiryListFilter): SQL[] {
  const criteria = enquiryViewCriteria(filter.view);
  const conditions: SQL[] = [scopeCondition(filter.scope)];
  if (criteria.statuses) conditions.push(inArray(marketingEnquiry.status, [...criteria.statuses]));
  if (criteria.assignee === "viewer") {
    conditions.push(eq(marketingEnquiry.assignedToUserId, filter.scope.viewerUserId));
  } else if (criteria.assignee === "nobody") {
    conditions.push(isNull(marketingEnquiry.assignedToUserId));
  }
  if (criteria.privateSaleOnly) {
    conditions.push(inArray(marketingEnquiry.intent, [...PRIVATE_SALE_ENQUIRY_INTENTS]));
  }
  return conditions;
}

function filterConditions(filter: EnquiryListFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.intent) conditions.push(eq(marketingEnquiry.intent, filter.intent));
  if (filter.departmentSlug) {
    conditions.push(eq(marketingEnquiry.departmentSlug, filter.departmentSlug));
  }
  if (filter.status) conditions.push(eq(marketingEnquiry.status, filter.status));
  if (filter.assignee === "unassigned") {
    conditions.push(isNull(marketingEnquiry.assignedToUserId));
  } else if (filter.assignee) {
    conditions.push(eq(marketingEnquiry.assignedToUserId, filter.assignee));
  }
  return conditions;
}

export class DrizzleMarketingEnquiryRepository implements IMarketingEnquiryRepository {
  constructor(private readonly db: Database) {}

  async createInTransaction(
    tx: Database,
    input: NewMarketingEnquiry,
  ): Promise<MarketingEnquiryRecord> {
    const [row] = await tx
      .insert(marketingEnquiry)
      .values({
        intent: input.intent,
        topic: input.topic,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message,
        sourcePage: input.sourcePage ?? null,
        departmentSlug: input.departmentSlug ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        userId: input.userId ?? null,
        legalEntityId: input.legalEntityId ?? null,
        marketingOptIn: input.marketingOptIn,
      })
      .returning();
    if (!row) throw new Error("marketing enquiry insert returned no row");
    if (input.privateSale) {
      await tx.insert(privateSaleEnquiryDetail).values({ enquiryId: row.id, ...input.privateSale });
    }
    return toRecord(row);
  }

  async findById(id: string): Promise<MarketingEnquiryRecord | null> {
    const [row] = await this.db
      .select()
      .from(marketingEnquiry)
      .where(eq(marketingEnquiry.id, id))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async findByRef(ref: string): Promise<MarketingEnquiryDetailRecord | null> {
    const match = REFERENCE_PATTERN.test(ref)
      ? eq(marketingEnquiry.reference, ref)
      : eq(marketingEnquiry.id, ref);
    const [row] = await this.db.select().from(marketingEnquiry).where(match).limit(1);
    if (!row) return null;
    const [detail] = await this.db
      .select()
      .from(privateSaleEnquiryDetail)
      .where(eq(privateSaleEnquiryDetail.enquiryId, row.id))
      .limit(1);
    const attachments = await this.db
      .select()
      .from(marketingEnquiryAttachment)
      .where(eq(marketingEnquiryAttachment.enquiryId, row.id))
      .orderBy(asc(marketingEnquiryAttachment.kind), asc(marketingEnquiryAttachment.position));
    return {
      ...toRecord(row),
      privateSale: detail ? toPrivateSaleDetail(detail) : null,
      attachments: attachments.map((a) => ({
        id: a.id,
        uploadObjectId: a.uploadObjectId,
        kind: a.kind as "image" | "document",
        position: a.position,
      })),
    };
  }

  async list(filter: EnquiryListFilter): Promise<MarketingEnquiryRecord[]> {
    const { order } = enquiryViewCriteria(filter.view);
    const conditions = [...viewConditions(filter), ...filterConditions(filter)];
    if (filter.afterId) {
      // Compared against the anchor row in SQL: a JS Date would drop the microseconds.
      const anchorTime = sql`(select ${marketingEnquiry.createdAt} from ${marketingEnquiry} where ${marketingEnquiry.id} = ${filter.afterId})`;
      const compare = order === "oldest_first" ? gt : lt;
      conditions.push(
        or(
          compare(marketingEnquiry.createdAt, anchorTime),
          and(
            eq(marketingEnquiry.createdAt, anchorTime),
            compare(marketingEnquiry.id, filter.afterId),
          ),
        ) as SQL,
      );
    }
    const direction = order === "oldest_first" ? asc : desc;
    const rows = await this.db
      .select()
      .from(marketingEnquiry)
      .where(and(...conditions))
      .orderBy(direction(marketingEnquiry.createdAt), direction(marketingEnquiry.id))
      .limit(filter.limit + 1);
    return rows.map(toRecord);
  }

  async updateInTransaction(
    tx: Database,
    id: string,
    expectedVersion: number,
    change: MarketingEnquiryChange,
  ): Promise<MarketingEnquiryRecord | null> {
    const [row] = await tx
      .update(marketingEnquiry)
      .set({
        ...(change.status !== undefined ? { status: change.status } : {}),
        ...(change.closeReason !== undefined ? { closeReason: change.closeReason } : {}),
        ...(change.assignedToUserId !== undefined
          ? { assignedToUserId: change.assignedToUserId }
          : {}),
        ...(change.closed !== undefined
          ? {
              handledAt: change.closed?.at ?? null,
              handledByUserId: change.closed?.byUserId ?? null,
            }
          : {}),
        version: sql`${marketingEnquiry.version} + 1`,
      })
      .where(and(eq(marketingEnquiry.id, id), eq(marketingEnquiry.version, expectedVersion)))
      .returning();
    return row ? toRecord(row) : null;
  }

  async markHandledInTransaction(
    tx: Database,
    id: string,
    handledByUserId: string,
    at: Date,
  ): Promise<MarketingEnquiryRecord | null> {
    const [row] = await tx
      .update(marketingEnquiry)
      .set({
        status: "closed",
        handledAt: at,
        handledByUserId,
        version: sql`${marketingEnquiry.version} + 1`,
      })
      .where(
        and(
          eq(marketingEnquiry.id, id),
          inArray(marketingEnquiry.status, [...OPEN_ENQUIRY_STATUSES]),
        ),
      )
      .returning();
    return row ? toRecord(row) : null;
  }
}
