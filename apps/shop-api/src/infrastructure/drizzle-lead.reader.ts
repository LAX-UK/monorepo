import type { Database } from "@auction/db";
import {
  crmRecordLink,
  shopArtwork,
  shopArtworkInterest,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopOrder,
} from "@auction/db/schema";
import {
  type CrmDeliveryStatus,
  GUEST_LEAD_CRM_STATE_MATCH,
  GUEST_LEAD_TABS,
  type GuestLeadCrmState,
  type GuestLeadTab,
  guestOrderSubject,
} from "@auction/shop-domain";
import { type SQL, and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { LeadListFilter, LeadReader, LeadRecord } from "../application/ports/lead.reader.js";

/** The CRM's placeholder for a subject erased before it ever had a record. */
const CRM_TOMBSTONE_MODULE = "__tombstone__";

const lead = shopGuestCustomer;

/** The lead's id, qualified: inside the subqueries below a bare "id" would be ambiguous. */
const leadIdColumn = sql.raw('"shop_guest_customer"."id"');

/** The CRM record the worker linked to this lead (`guest:<id>`), if it is a real one. */
const crmLink = (leadId: SQL | string) =>
  and(
    eq(crmRecordLink.entityType, "subject"),
    sql`${crmRecordLink.entityId} = ('guest:' || ${leadId}::text)`,
    isNull(crmRecordLink.erasedAt),
    sql`${crmRecordLink.zohoModule} <> ${CRM_TOMBSTONE_MODULE}`,
  );

const hasCrmRecord = sql<boolean>`EXISTS (
  SELECT 1 FROM ${crmRecordLink} WHERE ${crmLink(leadIdColumn)}
)`;

/** The CRM consumer's delivery of the newest lead event for this lead. */
const latestCrmDelivery = sql<CrmDeliveryStatus | null>`(
  SELECT d.status FROM domain_events e
  JOIN domain_event_delivery d ON d.event_id = e.id AND d.consumer = 'zoho'
  WHERE e.aggregate_type = 'shop_guest_customer' AND e.aggregate_id = ${leadIdColumn}::text
    AND e.event_type = 'shop.guest_lead.recorded'
  ORDER BY e.id DESC LIMIT 1
)`;

/** Mirrors `guestLeadStatus`: paid orders first, then a checkout reached, else an enquiry. */
const statusIs: Record<Exclude<GuestLeadTab, "all" | "joined">, SQL> = {
  ordered: sql`${lead.paidOrderCount} > 0`,
  abandoned_checkout: sql`${lead.paidOrderCount} = 0 AND ${lead.checkoutStartedAt} IS NOT NULL`,
  enquired: sql`${lead.paidOrderCount} = 0 AND ${lead.checkoutStartedAt} IS NULL`,
};

function tabCondition(tab: GuestLeadTab): SQL | undefined {
  if (tab === "all") return undefined;
  if (tab === "joined") return isNotNull(lead.claimedAt);
  return and(isNull(lead.claimedAt), statusIs[tab]);
}

/** The CRM state filter, built from the same table the domain reads the state from. */
function crmCondition(state: GuestLeadCrmState): SQL | undefined {
  const rule = GUEST_LEAD_CRM_STATE_MATCH[state];
  const record = rule.hasCrmRecord ? hasCrmRecord : sql`NOT ${hasCrmRecord}`;
  if (!rule.deliveries) return record;
  const named = rule.deliveries.filter((d): d is CrmDeliveryStatus => d !== null);
  const parts: SQL[] = [];
  if (named.length > 0) {
    parts.push(
      sql`${latestCrmDelivery} IN (${sql.join(
        named.map((d) => sql`${d}`),
        sql`, `,
      )})`,
    );
  }
  if (rule.deliveries.includes(null)) parts.push(sql`${latestCrmDelivery} IS NULL`);
  return and(record, or(...parts));
}

function filterConditions(filter: LeadListFilter): SQL[] {
  const conditions: SQL[] = [isNull(lead.erasedAt)];
  if (filter.q) {
    const contains = `%${filter.q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const search = or(sql`${lead.email} ILIKE ${contains}`, sql`${lead.name} ILIKE ${contains}`);
    if (search) conditions.push(search);
  }
  if (filter.source) conditions.push(eq(lead.source, filter.source));
  if (filter.consent) conditions.push(eq(lead.marketingConsent, filter.consent === "given"));
  if (filter.crm) {
    const crm = crmCondition(filter.crm);
    if (crm) conditions.push(crm);
  }
  return conditions;
}

const recordColumns = {
  id: lead.id,
  name: lead.name,
  email: lead.email,
  phone: lead.phone,
  source: lead.source,
  checkoutStartedAt: lead.checkoutStartedAt,
  firstSeenAt: lead.firstSeenAt,
  lastSeenAt: lead.lastSeenAt,
  paidOrderCount: lead.paidOrderCount,
  enquiryCount: lead.enquiryCount,
  marketingConsent: lead.marketingConsent,
  marketingConsentAt: lead.marketingConsentAt,
  marketingConsentVersion: lead.marketingConsentVersion,
  claimedAt: lead.claimedAt,
  claimedSubjectId: lead.claimedSubjectId,
  latestCrmDelivery,
  hasCrmRecord,
};

async function crmRecordOf(db: Database, leadId: string) {
  const [link] = await db
    .select({ module: crmRecordLink.zohoModule, recordId: crmRecordLink.zohoRecordId })
    .from(crmRecordLink)
    .where(crmLink(leadId))
    .limit(1);
  return link ?? null;
}

export function createDrizzleLeadReader(db: Database): LeadReader {
  return {
    async list(filter) {
      const conditions = filterConditions(filter);
      const after = filter.after
        ? sql`(${lead.lastSeenAt}, ${lead.id}) < (${filter.after.lastSeenAt}, ${filter.after.id})`
        : undefined;
      const tab = tabCondition(filter.tab);
      const rows = await db
        .select(recordColumns)
        .from(lead)
        .where(and(...conditions, ...(tab ? [tab] : []), ...(after ? [after] : [])))
        .orderBy(desc(lead.lastSeenAt), desc(lead.id))
        .limit(filter.limit);
      // Counts per tab, under the same search and filters but not the tab itself.
      const [countRow] = await db
        .select(
          Object.fromEntries(
            GUEST_LEAD_TABS.map((key) => {
              const condition = tabCondition(key);
              return [
                key,
                condition
                  ? sql<number>`count(*) FILTER (WHERE ${condition})::int`
                  : sql<number>`count(*)::int`,
              ];
            }),
          ) as Record<GuestLeadTab, SQL<number>>,
        )
        .from(lead)
        .where(and(...conditions));
      const counts = Object.fromEntries(
        GUEST_LEAD_TABS.map((key) => [key, Number(countRow?.[key] ?? 0)]),
      ) as Record<GuestLeadTab, number>;
      return { rows, counts };
    },

    async get(leadId) {
      const [row] = await db
        .select(recordColumns)
        .from(lead)
        .where(and(eq(lead.id, leadId), isNull(lead.erasedAt)))
        .limit(1);
      if (!row) return null;
      const record: LeadRecord = row;
      const crmRecord = await crmRecordOf(db, leadId);
      const orders = await db
        .select({
          orderId: shopOrder.id,
          reference: shopOrder.reference,
          status: shopOrder.status,
          totalPence: shopOrder.totalPence,
          createdAt: shopOrder.createdAt,
          paidAt: shopOrder.paidAt,
        })
        .from(shopOrder)
        .where(
          or(
            eq(shopOrder.guestCustomerId, leadId),
            eq(shopOrder.identitySubjectId, guestOrderSubject(leadId)),
          ),
        )
        .orderBy(desc(shopOrder.createdAt));
      const artwork = await db
        .select({
          enquiryId: shopArtworkInterest.id,
          reference: shopArtworkInterest.reference,
          subject: shopArtwork.title,
          createdAt: shopArtworkInterest.createdAt,
        })
        .from(shopArtworkInterest)
        .innerJoin(shopArtwork, eq(shopArtwork.id, shopArtworkInterest.artworkId))
        .where(
          and(
            eq(shopArtworkInterest.intent, "enquiry"),
            sql`lower(${shopArtworkInterest.contactEmail}) = ${row.email}`,
          ),
        );
      const general = await db
        .select({
          enquiryId: shopGeneralEnquiry.id,
          reference: shopGeneralEnquiry.reference,
          subject: shopGeneralEnquiry.topic,
          createdAt: shopGeneralEnquiry.createdAt,
        })
        .from(shopGeneralEnquiry)
        .where(
          and(
            sql`lower(${shopGeneralEnquiry.contactEmail}) = ${row.email}`,
            sql`${shopGeneralEnquiry.topic} <> 'order_problem'`,
          ),
        );
      const enquiries = [
        ...artwork.map((e) => ({ ...e, kind: "artwork" as const, reference: e.reference ?? "" })),
        ...general.map((e) => ({ ...e, kind: "general" as const, subject: String(e.subject) })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { ...record, crmRecord, orders, enquiries };
    },
  };
}
