import type { KycStatusSummary } from "../kyc/kyc-contracts.js";
import type {
  IKycGateService,
  IKycSessionService,
  IKycWebhookIngestService,
} from "../kyc/ports.js";

export type {
  CreateKycSessionResult,
  KycStatusSummary,
  KycWebhookHandleResult,
} from "../kyc/kyc-contracts.js";
export type { KycFeedbackAction, KycUserFeedback } from "../kyc/kyc-user-feedback.js";

export class KycNotConfiguredError extends Error {
  constructor() {
    super("kyc_not_configured: set VERIFF_API_KEY and VERIFF_SHARED_SECRET to enable KYC");
    this.name = "KycNotConfiguredError";
  }
}

export class KycAlreadyApprovedError extends Error {
  readonly status = 409;
  readonly code = "kyc_already_approved";
  constructor() {
    super("kyc_already_approved");
    this.name = "KycAlreadyApprovedError";
  }
}

export class VeriffWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VeriffWebhookPayloadError";
  }
}

/** Thrown by `requireKyc`-guarded paths when the user is below threshold. */
export class KycRequiredError extends Error {
  readonly status = 402;
  readonly code = "kyc_required";
  constructor(public readonly summary: KycStatusSummary) {
    super("kyc_required");
    this.name = "KycRequiredError";
  }
}

export interface IKycService
  extends IKycSessionService,
    IKycWebhookIngestService,
    IKycGateService {}
