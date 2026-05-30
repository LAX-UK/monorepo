/** Minimal legal-entity fields for Connect readiness (isomorphic — API + web). */
export type ConnectLegalEntityFields = {
  status: string;
  stripeConnectAccountId?: string | null;
  stripeConnectChargesEnabled?: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue?: string[] | null;
  stripeConnectDisabledReason?: string | null;
  isLaxManaged?: boolean;
};

export type ConnectAccountStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
  /** Stripe account configured for transfers (payouts + no due requirements). */
  ready: boolean;
  /** True when live Stripe sync failed and cached flags were returned instead. */
  syncDegraded?: boolean;
};

export type ConnectGapStage =
  | "managed_by_lax"
  | "not_started"
  | "kyc_required"
  | "onboarding_incomplete"
  | "requirements_due"
  | "ready"
  | "restricted";

export type ConnectRequirementSeverity = "info" | "warning" | "error";

export type ConnectRequirementLabel = {
  label: string;
  hint: string;
  severity: ConnectRequirementSeverity;
};

export type ConnectGapMissingItem = {
  key: string;
  label: string;
  hint: string;
  severity: ConnectRequirementSeverity;
};

export type ConnectGapState = {
  stage: ConnectGapStage;
  missing: ConnectGapMissingItem[];
  canReceivePayouts: boolean;
  canPublish: boolean;
  /** Raw Stripe disabled_reason when present — used for copy branching. */
  disabledReason?: string | null;
};

export type ConnectGapOptions = {
  /** When true (individual sellers), gate on KYC before Connect. */
  kycApproved?: boolean;
};
