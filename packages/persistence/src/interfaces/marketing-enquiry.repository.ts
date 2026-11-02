import type { Database } from "@auction/db";

export type MarketingEnquiryStatus = "new" | "handled";

/** A contact form message as client services read it. */
export type MarketingEnquiryRecord = {
  id: string;
  topic: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string | null;
  status: MarketingEnquiryStatus;
  createdAt: Date;
  handledAt: Date | null;
  handledByUserId: string | null;
};

export type NewMarketingEnquiry = {
  topic: string;
  name: string;
  email: string;
  phone?: string | undefined;
  message: string;
  sourcePage?: string | undefined;
};

/** Contact form enquiries. */
export interface IMarketingEnquiryRepository {
  /** Stores an enquiry inside the caller's transaction. */
  createInTransaction(tx: Database, input: NewMarketingEnquiry): Promise<MarketingEnquiryRecord>;
  findById(id: string): Promise<MarketingEnquiryRecord | null>;
  /**
   * Marks a new enquiry handled inside the caller's transaction. Returns the updated enquiry,
   * or `null` when it is not new (already handled, or no such enquiry).
   */
  markHandledInTransaction(
    tx: Database,
    id: string,
    handledByUserId: string,
    at: Date,
  ): Promise<MarketingEnquiryRecord | null>;
}
