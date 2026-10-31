import type { AccessRequestStatus, ActivityGroup } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** The address printed on invoices. */
export type InvoiceAddressView = {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
};

/** The organisation's invoice details, with whether this member may change them. */
export type InvoiceDetailsView = {
  billingEmail: string | null;
  /** `null`: invoices use the registered address. */
  address: InvoiceAddressView | null;
  poReference: string | null;
  updatedAt: string | null;
  canEdit: boolean;
};

export type ActivityDetailValue = string | number | boolean | null | string[];

/** One Activity line as the API sends it, with the people in it named ("LAX" for staff). */
export type ActivityEntryView = {
  id: number;
  kind: string;
  group: ActivityGroup;
  occurredAt: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  detail: Record<string, ActivityDetailValue>;
  actorName: string;
  subjectName: string | null;
};

export type ActivityPageView = {
  entries: ActivityEntryView[];
  /** Pass as `before` for the next page; `null` on the last. */
  nextBefore: number | null;
};

/** The Activity filters, as the API takes them. */
export type ActivityQuery = {
  person?: string | undefined;
  group?: readonly ActivityGroup[] | undefined;
  from?: string | undefined;
  to?: string | undefined;
  before?: number | undefined;
  limit?: number | undefined;
};

/** The query string for an Activity read or export, without the leading "?". */
export function activityQueryString(query: ActivityQuery): string {
  const params = new URLSearchParams();
  if (query.person) params.set("person", query.person);
  if (query.group && query.group.length > 0) params.set("group", query.group.join(","));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.before) params.set("before", String(query.before));
  if (query.limit) params.set("limit", String(query.limit));
  return params.toString();
}

/** One "Ask for access" request. */
export type AccessRequestView = {
  id: string;
  requesterUserId: string;
  requesterName: string | null;
  requestedRole: LegalEntityMemberRole | null;
  requestedCapability: string | null;
  reason: string;
  status: AccessRequestStatus;
  grantedRole: LegalEntityMemberRole | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};
