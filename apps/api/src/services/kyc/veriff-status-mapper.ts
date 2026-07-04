import type { KycVerification, UserKycStatus } from "@auction/types";
import type { KycDecisionApplyInput } from "./kyc-decision-processor.js";
import { extractVerifiedFieldsFromVeriffDecision } from "./kyc-verified-fields.js";

export type VeriffVerificationDecision = {
  id: string;
  attemptId?: string | null;
  status: string;
  code?: number | null;
  reasonCode?: number | null;
  person?: Record<string, unknown> | null;
  document?: Record<string, unknown> | null;
  decisionTime?: string | null;
  riskScore?: unknown;
  ipCountry?: string | null;
};

/** Pulls a risk-score signal from the (passthrough) Veriff verification payload. */
function extractRiskScore(verification: VeriffVerificationDecision): string | null {
  const raw = verification.riskScore;
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "string") return String(raw);
  if (typeof raw === "object") {
    const score = (raw as { score?: unknown }).score;
    if (typeof score === "number" || typeof score === "string") return String(score);
  }
  return null;
}

const KNOWN_DECISION_STATUSES = new Set([
  "approved",
  "resubmission_requested",
  "declined",
  "expired",
  "abandoned",
  "review",
  "submitted",
]);

/** Veriff programmatic decision codes — fallback when status is missing or unknown. */
const VERIFF_CODE_TO_STATUS: Record<number, string> = {
  9001: "approved",
  9102: "declined",
  9103: "resubmission_requested",
  9104: "expired",
  9121: "abandoned",
};

function resolveVeriffDecisionStatus(status: string, code?: number | null): string {
  const normalized = status.trim();
  if (normalized && KNOWN_DECISION_STATUSES.has(normalized)) {
    return normalized;
  }
  if (code != null && VERIFF_CODE_TO_STATUS[code]) {
    return VERIFF_CODE_TO_STATUS[code];
  }
  return normalized || "unknown";
}

/** Fraud / hard-fail reason codes — increment retry count. */
const VERIFF_HARD_FAILURE_REASON_CODES = new Set([
  101, 103, 104, 105, 106, 108, 109, 110, 539, 502, 503, 504, 505, 506, 512, 513, 514, 516, 517,
  518, 519, 520, 521, 522, 523, 524, 525, 529, 538, 556, 567, 568, 569, 570, 571, 572, 573, 574,
  575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586, 587, 602, 620, 621, 622, 623,
]);

const VERIFF_DECISION_TO_VERIFICATION_STATUS: Record<string, KycVerification["status"]> = {
  approved: "verified",
  resubmission_requested: "requires_input",
  declined: "canceled",
  expired: "canceled",
  abandoned: "canceled",
  review: "processing",
  submitted: "processing",
};

function mapVerificationStatus(status: string): KycVerification["status"] {
  return VERIFF_DECISION_TO_VERIFICATION_STATUS[status] ?? "created";
}

type UserKycUpdate = KycDecisionApplyInput["userKycUpdate"];

const VERIFF_DECISION_TO_USER_KYC_UPDATE: Record<string, UserKycUpdate> = {
  approved: { setStatus: "approved", verifiedAt: new Date(), incrementRetry: false },
  resubmission_requested: { setStatus: "pending", verifiedAt: null, incrementRetry: false },
  review: { setStatus: "pending", verifiedAt: null, incrementRetry: false },
  submitted: { setStatus: "pending", verifiedAt: null, incrementRetry: false },
  expired: { setStatus: "unverified", verifiedAt: null, incrementRetry: false },
  abandoned: { setStatus: "unverified", verifiedAt: null, incrementRetry: false },
};

function userKycUpdateFromVeriffDecision(
  status: string,
  reasonCode: number | null | undefined,
): UserKycUpdate {
  if (status === "declined") {
    const incrementRetry = reasonCode != null && VERIFF_HARD_FAILURE_REASON_CODES.has(reasonCode);
    return { setStatus: "rejected", verifiedAt: null, incrementRetry };
  }
  return (
    VERIFF_DECISION_TO_USER_KYC_UPDATE[status] ?? {
      setStatus: "pending",
      verifiedAt: null,
      incrementRetry: false,
    }
  );
}

export function mapVeriffDecisionToApplyInput(
  verification: VeriffVerificationDecision,
  decisionPayload: Record<string, unknown>,
): KycDecisionApplyInput {
  const status = resolveVeriffDecisionStatus(verification.status, verification.code);
  const verificationStatus = mapVerificationStatus(status);
  const userKycUpdate = userKycUpdateFromVeriffDecision(status, verification.reasonCode);
  const isTerminal = ["approved", "declined", "expired", "abandoned"].includes(status);

  return {
    providerSessionId: verification.id,
    providerAttemptId: verification.attemptId ?? null,
    verificationStatus,
    userKycUpdate,
    verifiedFields: extractVerifiedFieldsFromVeriffDecision({
      person: verification.person,
      document: verification.document,
      riskScore: extractRiskScore(verification),
      ipCountry: verification.ipCountry ?? null,
    }),
    decisionPayload,
    decisionAt: isTerminal
      ? verification.decisionTime
        ? new Date(verification.decisionTime)
        : new Date()
      : null,
    isApproved: status === "approved",
  };
}

const VERIFF_EVENT_TO_VERIFICATION_STATUS: Record<string, KycVerification["status"]> = {
  submitted: "processing",
  started: "created",
};

const VERIFF_EVENT_TO_USER_STATUS: Record<string, UserKycStatus> = {
  submitted: "pending",
};

/** Maps Veriff event webhook `action` to verification status update (optional UX path). */
export function mapVeriffEventToVerificationStatus(
  action: string,
): KycVerification["status"] | null {
  return VERIFF_EVENT_TO_VERIFICATION_STATUS[action] ?? null;
}

export function mapVeriffEventToUserStatus(action: string): UserKycStatus | null {
  return VERIFF_EVENT_TO_USER_STATUS[action] ?? null;
}
