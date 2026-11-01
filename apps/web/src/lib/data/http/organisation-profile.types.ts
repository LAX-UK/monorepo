import type { PayoutBankAccountStatus, StatementAvailability } from "@auction/domain";

/** How buyers and LAX reach the organisation, with whether this member may change it. */
export type ContactDetailsView = {
  email: string | null;
  phone: string | null;
  website: string | null;
  updatedAt: string | null;
  canEdit: boolean;
};

/** One statement in the document library. */
export type StatementView = {
  kind: "payout";
  payoutId: string;
  periodStart: string;
  periodEnd: string;
  netAmount: string;
  currency: string;
  payoutStatus: string;
  issuedAt: string;
  availability: StatementAvailability;
};

/** The bank account payouts go to, as a summary. */
export type PayoutBankAccountView = {
  bankName: string | null;
  last4: string | null;
  accountHolderName: string | null;
  currency: string | null;
  status: PayoutBankAccountStatus;
};

export type PayoutAccountView =
  | { state: "not_set_up" | "none" | "unavailable"; account: null }
  | { state: "ready"; account: PayoutBankAccountView };

export type MemberLastActiveView = {
  available: boolean;
  members: { userId: string; lastActiveOn: string | null }[];
};
