import type { LotStatus } from "@auction/types";
/** What the thread's side panel shows about the consignment, the account and its people. */
export type ConsignmentThreadFactsRecord = {
  submission: {
    image: string | null;
    status: string;
    medium: string | null;
    yearOfWork: string | null;
  };
  sale: { id: string; name: string; startsAt: Date | null } | null;
  /** The lot, with its state and whether it sold, for the consignment's step. */
  lot: { id: string; number: number | null; status: LotStatus; sold: boolean } | null;
  agreement: {
    estimateLow: string | null;
    estimateHigh: string | null;
    reservePrice: string | null;
    currency: string;
    proposedAt: Date;
    acceptedAt: Date | null;
  } | null;
  /** The member who sent the work, with their place in the account. */
  sender: { name: string; memberRole: string | null } | null;
  /** Names of the account's owners and admins other than the sender. */
  alsoNotified: string[];
  /** Consignments the account has sent (drafts do not count). */
  accountConsignmentCount: number;
};

export interface IConsignmentThreadFactsReader {
  /** `null` when the consignment is unknown. */
  readFacts(submissionId: string): Promise<ConsignmentThreadFactsRecord | null>;
}
