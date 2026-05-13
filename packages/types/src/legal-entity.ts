/** Legal Entity Kind - top-level taxonomy */
export const legalEntityKinds = ["individual", "organisation"] as const;
export type LegalEntityKind = (typeof legalEntityKinds)[number];

/** Legal Entity Subkind - context-dependent taxonomy */
export const legalEntitySubkinds = [
  "artist",
  "private_collector",
  "gallery",
  "dealer",
  "estate",
  "company",
  "charity",
  "institution",
  "lax_stock",
  "other",
] as const;
export type LegalEntitySubkind = (typeof legalEntitySubkinds)[number];

/** Legal Entity Status - verification lifecycle */
export const legalEntityStatuses = [
  "lead",
  "docs_requested",
  "docs_received",
  "under_review",
  "connect_pending",
  "approved",
  "restricted",
  "rejected",
  "archived",
] as const;
export type LegalEntityStatus = (typeof legalEntityStatuses)[number];

/** Member Roles - capabilities within a legal entity */
export const legalEntityMemberRoles = [
  "owner",
  "admin",
  "consignor",
  "finance",
  "buyer_agent",
  "viewer",
  "specialist",
  "staff",
] as const;
export type LegalEntityMemberRole = (typeof legalEntityMemberRoles)[number];

/** KYC Status for users (Stripe Identity) */
export const userKycStatuses = ["unverified", "pending", "approved", "rejected"] as const;
export type UserKycStatus = (typeof userKycStatuses)[number];

/** Legal Entity - the core symmetric model for buyers and sellers */
export type LegalEntity = {
  id: string;
  displayName: string;
  legalName: string | null;
  slug: string | null;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  createdByUserId: string;
  status: LegalEntityStatus;
  statusChangedAt: Date | null;
  statusChangedByUserId: string | null;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue: string[];
  stripeConnectDisabledReason: string | null;
  xeroContactId: string | null;
  vatNumber: string | null;
  marginSchemeEligible: boolean;
  isLaxManaged: boolean;
  platformFeeBps: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Lightweight summary for acting context switcher */
export type LegalEntitySummary = {
  id: string;
  displayName: string;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  status: LegalEntityStatus;
  role: LegalEntityMemberRole;
  isPrimaryAdmin: boolean;
  /** synthetic acting row when a platform admin impersonates. */
  isImpersonation?: boolean;
};

/** Legal Entity Member - user membership in an entity */
export type LegalEntityMember = {
  id: string;
  legalEntityId: string;
  userId: string;
  role: LegalEntityMemberRole;
  isPrimaryAdmin: boolean;
  invitedByUserId: string | null;
  invitedAt: Date | null;
  acceptedAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
};

/** Legal Entity Address */
export type LegalEntityAddress = {
  id: string;
  legalEntityId: string;
  addressType: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
};

/** Legal Entity Document - KYB upload with review state */
export type LegalEntityDocument = {
  id: string;
  legalEntityId: string;
  uploadObjectId: string;
  kind: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  uploadedByUserId: string;
  uploadedAt: Date;
};

/** Create Legal Entity Input */
export type CreateLegalEntityInput = {
  displayName: string;
  legalName?: string | undefined;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
};

/** Invite Member Input */
export type InviteLegalEntityMemberInput = {
  email: string;
  role: LegalEntityMemberRole;
};

/** KYC Verification record (Stripe Identity) */
export type KycVerification = {
  id: string;
  userId: string;
  provider: string;
  stripeVerificationSessionId: string;
  status: "created" | "requires_input" | "processing" | "verified" | "canceled";
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: Date | null;
  verifiedIdNumberLast4: string | null;
  verifiedIdCountry: string | null;
  verifiedIdType: string | null;
  verifiedIdExpiry: Date | null;
  createdAt: Date;
  decisionAt: Date | null;
};
