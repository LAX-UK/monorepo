import type { AdminLeadSummary } from "@auction/shop-contracts";
import {
  GUEST_LEAD_CRM_STATES,
  GUEST_LEAD_CRM_STATE_LABEL,
  GUEST_LEAD_SOURCES,
  GUEST_LEAD_SOURCE_LABEL,
  GUEST_LEAD_STATUS_LABEL,
  GUEST_LEAD_TABS,
  type GuestLeadCrmState,
  type GuestLeadSource,
  type GuestLeadStatus,
  type GuestLeadTab,
} from "@auction/shop-domain";
import { STAFF_DEFAULT_PAGE_SIZE, formatStaffDate, parseStaffPageSize } from "@auction/staff-ui";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const LEAD_LIST_PATH = "/leads";

const CONSENTS = ["given", "not_given"] as const;
type Consent = (typeof CONSENTS)[number];

/** The leads list's state, as it appears in the page URL. Every field is optional. */
export type LeadListQuery = {
  tab?: Exclude<GuestLeadTab, "all">;
  q?: string;
  source?: GuestLeadSource;
  consent?: Consent;
  crm?: GuestLeadCrmState;
  cursor?: string;
  limit?: string;
};

export const LEAD_CONSENT_LABEL: Record<Consent, string> = {
  given: "Opted in to news",
  not_given: "Not opted in",
};

export const LEAD_SOURCE_OPTIONS = GUEST_LEAD_SOURCES.map((value) => ({
  value,
  label: GUEST_LEAD_SOURCE_LABEL[value],
}));
export const LEAD_CRM_OPTIONS = GUEST_LEAD_CRM_STATES.map((value) => ({
  value,
  label: GUEST_LEAD_CRM_STATE_LABEL[value],
}));
export const LEAD_CONSENT_OPTIONS = CONSENTS.map((value) => ({
  value,
  label: LEAD_CONSENT_LABEL[value],
}));

const TABS_WITHOUT_ALL = GUEST_LEAD_TABS.filter(
  (tab): tab is Exclude<GuestLeadTab, "all"> => tab !== "all",
);

export function parseLeadListQuery(params: RawSearchParams): LeadListQuery {
  const tab = oneOf(singleParam(params.tab), TABS_WITHOUT_ALL);
  const q = singleParam(params.q);
  const source = oneOf(singleParam(params.source), GUEST_LEAD_SOURCES);
  const consent = oneOf(singleParam(params.consent), CONSENTS);
  const crm = oneOf(singleParam(params.crm), GUEST_LEAD_CRM_STATES);
  const cursor = singleParam(params.cursor);
  const limit = parseStaffPageSize(singleParam(params.limit));
  return {
    ...(tab ? { tab } : {}),
    ...(q ? { q } : {}),
    ...(source ? { source } : {}),
    ...(consent ? { consent } : {}),
    ...(crm ? { crm } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit !== STAFF_DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
  };
}

/** True when anything narrows the list beyond the tab; paging does not count. */
export function hasActiveLeadFilters(query: LeadListQuery): boolean {
  return Boolean(query.q || query.source || query.consent || query.crm);
}

export function leadListHref(
  query: LeadListQuery,
  change: { [K in keyof LeadListQuery]?: LeadListQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query, cursor: undefined };
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(LEAD_LIST_PATH, next);
}

export function leadListPageHref(query: LeadListQuery, cursor: string): string {
  return listHref(LEAD_LIST_PATH, { ...query, cursor });
}

/** The query the leads API expects for this URL state. */
export function leadListApiQuery(query: LeadListQuery): Record<string, string> {
  const api: Record<string, string | undefined> = {
    tab: query.tab,
    q: query.q,
    source: query.source,
    consent: query.consent,
    crm: query.crm,
    limit: query.limit,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

export type LeadBadgeTone = "info" | "success" | "warning" | "danger" | "neutral";

const STATUS_TONE: Record<GuestLeadStatus, LeadBadgeTone> = {
  ordered: "success",
  abandoned_checkout: "warning",
  enquired: "info",
};

/** A lead's status badge; one who opened a LAX account reads "Joined LAX". */
export function presentLeadStatus(lead: Pick<AdminLeadSummary, "status" | "joinedAt">): {
  label: string;
  tone: LeadBadgeTone;
} {
  if (lead.joinedAt) return { label: "Joined LAX", tone: "neutral" };
  return { label: GUEST_LEAD_STATUS_LABEL[lead.status], tone: STATUS_TONE[lead.status] };
}

const CRM_TONE: Record<GuestLeadCrmState, LeadBadgeTone> = {
  synced: "success",
  pending: "info",
  failed: "danger",
  not_sent: "neutral",
};

export function presentLeadCrm(state: GuestLeadCrmState): { label: string; tone: LeadBadgeTone } {
  return { label: GUEST_LEAD_CRM_STATE_LABEL[state], tone: CRM_TONE[state] };
}

/** The name, or the email when the guest gave none. */
export function leadName(lead: Pick<AdminLeadSummary, "name" | "email">): string {
  return lead.name?.trim() || lead.email;
}

/** "Opted in, 30 Oct 2026 (wording shop-guest-news-2026-10-30)", or "Not opted in". */
export function leadConsentLine(consent: AdminLeadSummary["consent"]): string {
  if (!consent.given) return LEAD_CONSENT_LABEL.not_given;
  const at = consent.at ? `, ${formatStaffDate(consent.at)}` : "";
  return `Opted in${at}`;
}

/** "2 orders · 1 enquiry", leaving out what is zero; "Nothing yet" when both are. */
export function leadActivitySummary(
  lead: Pick<AdminLeadSummary, "paidOrderCount" | "enquiryCount">,
): string {
  const parts = [
    lead.paidOrderCount > 0
      ? `${lead.paidOrderCount} ${lead.paidOrderCount === 1 ? "order" : "orders"}`
      : null,
    lead.enquiryCount > 0
      ? `${lead.enquiryCount} ${lead.enquiryCount === 1 ? "enquiry" : "enquiries"}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No orders yet";
}

/** The leads on this page as CSV; consent carries the wording version it was given against. */
export function leadsCsv(rows: readonly AdminLeadSummary[]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = [
    "Name",
    "Email",
    "Status",
    "Source",
    "First seen",
    "Last seen",
    "Paid orders",
    "Enquiries",
    "Marketing consent",
    "Consent given",
    "Consent wording",
    "CRM",
  ];
  const lines = rows.map((row) =>
    [
      row.name ?? "",
      row.email,
      presentLeadStatus(row).label,
      GUEST_LEAD_SOURCE_LABEL[row.source],
      row.firstSeenAt,
      row.lastSeenAt,
      String(row.paidOrderCount),
      String(row.enquiryCount),
      row.consent.given ? "Yes" : "No",
      row.consent.at ?? "",
      row.consent.version ?? "",
      GUEST_LEAD_CRM_STATE_LABEL[row.crm],
    ]
      .map(quote)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/**
 * The CRM record's page, from a template such as
 * "https://crm.zoho.eu/crm/org123/tab/{module}/{recordId}"; null without one.
 */
export function crmRecordUrl(
  template: string | null | undefined,
  record: { module: string; recordId: string } | null,
): string | null {
  if (!template || !record) return null;
  return template
    .replace("{module}", encodeURIComponent(record.module))
    .replace("{recordId}", encodeURIComponent(record.recordId));
}
