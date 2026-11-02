import type { MarketingEnquiryRecord } from "@auction/persistence/interfaces";

/** Tells the staff enquiry inbox that a message arrived. */
export interface IMarketingEnquiryAlert {
  notify(enquiry: MarketingEnquiryRecord): Promise<void>;
}

/** Used when no staff enquiry inbox is configured: the work inbox is the only notice. */
export const noMarketingEnquiryAlert: IMarketingEnquiryAlert = {
  async notify() {},
};
