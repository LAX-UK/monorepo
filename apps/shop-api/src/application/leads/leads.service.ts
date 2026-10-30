import type {
  AdminLeadDetail,
  AdminLeadListQuery,
  AdminLeadListResponse,
  AdminLeadSummary,
} from "@auction/shop-contracts";
import { guestLeadCrmState, guestLeadStatus } from "@auction/shop-domain";
import type { LeadReader, LeadRecord } from "../ports/lead.reader.js";

const DEFAULT_LIMIT = 25;

/** The cursor is the last row's last-seen time and id, opaque to the browser. */
export function encodeLeadCursor(row: { lastSeenAt: Date; id: string }): string {
  return Buffer.from(`${row.lastSeenAt.toISOString()}|${row.id}`).toString("base64url");
}

export function decodeLeadCursor(
  cursor: string | undefined,
): { lastSeenAt: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const lastSeenAt = at ? new Date(at) : null;
  if (!lastSeenAt || Number.isNaN(lastSeenAt.getTime()) || !id) return null;
  return { lastSeenAt, id };
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** A stored lead as staff read it: its status and CRM state come from the domain rules. */
export function presentLead(row: LeadRecord): AdminLeadSummary {
  return {
    leadId: row.id,
    name: row.name,
    email: row.email,
    status: guestLeadStatus(row),
    source: row.source,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    paidOrderCount: row.paidOrderCount,
    enquiryCount: row.enquiryCount,
    consent: {
      given: row.marketingConsent,
      at: iso(row.marketingConsentAt),
      version: row.marketingConsentVersion,
    },
    crm: guestLeadCrmState({
      hasCrmRecord: row.hasCrmRecord,
      latestDelivery: row.latestCrmDelivery,
    }),
    joinedAt: iso(row.claimedAt),
  };
}

/** Guest leads for LAX Admin: the list with counts per tab, and one lead's record. */
export class LeadsService {
  constructor(private readonly reader: LeadReader) {}

  async list(query: AdminLeadListQuery): Promise<AdminLeadListResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const { rows, counts } = await this.reader.list({
      tab: query.tab ?? "all",
      q: query.q?.trim() || null,
      source: query.source ?? null,
      consent: query.consent ?? null,
      crm: query.crm ?? null,
      after: decodeLeadCursor(query.cursor),
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(presentLead),
      counts,
      nextCursor: rows.length > limit && last ? encodeLeadCursor(last) : null,
    };
  }

  async get(leadId: string): Promise<AdminLeadDetail | null> {
    const row = await this.reader.get(leadId);
    if (!row) return null;
    return {
      ...presentLead(row),
      phone: row.phone,
      checkoutStartedAt: iso(row.checkoutStartedAt),
      joinedSubjectId: row.claimedSubjectId,
      crmRecord: row.crmRecord,
      orders: row.orders.map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        paidAt: iso(order.paidAt),
      })),
      enquiries: row.enquiries.map((enquiry) => ({
        ...enquiry,
        subject:
          enquiry.kind === "general"
            ? (GENERAL_TOPIC_LABEL[enquiry.subject] ?? enquiry.subject)
            : enquiry.subject,
        createdAt: enquiry.createdAt.toISOString(),
      })),
    };
  }
}

/** General enquiry topics as staff read them in a lead's history. */
const GENERAL_TOPIC_LABEL: Record<string, string> = {
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling a work",
  exhibition: "Exhibition",
};
