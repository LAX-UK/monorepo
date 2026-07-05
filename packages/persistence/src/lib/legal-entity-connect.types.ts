import type { legalEntity } from "@auction/db/schema";

import type { StripeConnectRequirementError } from "@auction/types";

/** Normalized postal address used for Stripe Connect account prefill. */
export type ConnectAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};

export type ConnectKycSnapshot = {
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: string | null;
  verifiedIdCountry: string | null;
};

export type LegalEntityConnectRow = typeof legalEntity.$inferSelect;

export type ConnectAccountCreationContextRow = {
  entity: LegalEntityConnectRow;
  ownerUserId: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerDisplayName: string | null;
  ownerKycStatus: string;
  ownerMobile: string | null;
  entityAddress: ConnectAddressSnapshot | null;
  userAddress: ConnectAddressSnapshot | null;
  kyc: ConnectKycSnapshot | null;
};

export type PersistConnectAccountInput = {
  legalEntityId: string;
  stripeAccountId: string;
  promoteLeadToConnectPending: boolean;
};

export type StripeConnectFlagPatch = {
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue: string[];
  stripeConnectRequirementsErrors: StripeConnectRequirementError[];
  stripeConnectDisabledReason: string | null;
};

export type ApplyConnectStatusTransitionInput = {
  legalEntityId: string;
  expectedStatus: LegalEntityConnectRow["status"];
  nextStatus: LegalEntityConnectRow["status"];
  flags: StripeConnectFlagPatch;
};
