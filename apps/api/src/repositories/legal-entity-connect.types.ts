import type { legalEntity } from "@auction/db/schema";
import type { ConnectKycSnapshot } from "../services/stripe/connect/connect-account-prefill.js";
import type { ConnectAddressSnapshot } from "../services/stripe/connect/connect-address-snapshot.js";

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
  stripeConnectDisabledReason: string | null;
};

export type ApplyConnectStatusTransitionInput = {
  legalEntityId: string;
  expectedStatus: LegalEntityConnectRow["status"];
  nextStatus: LegalEntityConnectRow["status"];
  flags: StripeConnectFlagPatch;
};
