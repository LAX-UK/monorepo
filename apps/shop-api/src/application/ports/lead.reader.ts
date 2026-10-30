import type {
  CrmDeliveryStatus,
  GuestLeadCrmState,
  GuestLeadSource,
  GuestLeadTab,
} from "@auction/shop-domain";

/** One guest lead as stored, with what the CRM integration knows about it. */
export type LeadRecord = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  source: GuestLeadSource;
  checkoutStartedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  paidOrderCount: number;
  enquiryCount: number;
  marketingConsent: boolean;
  marketingConsentAt: Date | null;
  marketingConsentVersion: string | null;
  claimedAt: Date | null;
  claimedSubjectId: string | null;
  hasCrmRecord: boolean;
  latestCrmDelivery: CrmDeliveryStatus | null;
};

export type LeadListFilter = {
  tab: GuestLeadTab;
  q: string | null;
  source: GuestLeadSource | null;
  consent: "given" | "not_given" | null;
  crm: GuestLeadCrmState | null;
  /** Newest last-seen first; the cursor is the last row of the previous page. */
  after: { lastSeenAt: Date; id: string } | null;
  limit: number;
};

export type LeadOrder = {
  orderId: string;
  reference: string;
  status: string;
  totalPence: number;
  createdAt: Date;
  paidAt: Date | null;
};

export type LeadEnquiry = {
  kind: "artwork" | "general";
  enquiryId: string;
  reference: string;
  /** The work's title, or the general enquiry's topic. */
  subject: string;
  createdAt: Date;
};

/** Guest leads for staff. Erased leads are never listed or opened. */
export interface LeadReader {
  list(
    filter: LeadListFilter,
  ): Promise<{ rows: LeadRecord[]; counts: Record<GuestLeadTab, number> }>;
  get(leadId: string): Promise<
    | (LeadRecord & {
        crmRecord: { module: string; recordId: string } | null;
        orders: LeadOrder[];
        enquiries: LeadEnquiry[];
      })
    | null
  >;
}
