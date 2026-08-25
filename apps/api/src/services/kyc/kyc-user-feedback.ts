import type { KycVerification, UserKycStatus } from "@auction/types";

export type KycFeedbackAction = "start" | "continue" | "retry" | "wait" | "none";

export type KycUserFeedback = {
  headline: string;
  detail: string | null;
  action: KycFeedbackAction;
  reasonCode: number | null;
  decisionStatus: string | null;
  needsResubmit: boolean;
};

type VeriffDecisionFields = {
  status?: string | null;
  reason?: string | null;
  reasonCode?: number | null;
};

const RESUBMISSION_GUIDANCE: Record<number, string> = {
  201: "Upload clear photos of your document and a selfie in good lighting.",
  202: "Make sure your face is fully visible and well lit in the selfie.",
  203: "Capture the entire document in the frame — all corners should be visible.",
  204: "Retake the photos in brighter light and hold the camera steady.",
  205: "Use an undamaged document, or try a different accepted ID type.",
  206: "Use a passport, driving licence, or national ID card.",
  207: "Use a document that is still valid.",
  208: "Include a selfie as part of the verification.",
  209: "Include a clear photo of your identity document.",
  210: "Photograph the front and back of your document, not the same side twice.",
  211: "Make sure the document text is readable in the photo.",
  212: "Move the document so all edges are inside the frame.",
  213: "Keep fingers and objects away from the document.",
  214: "Retake the selfie in brighter light without blur.",
  215: "Retake the document photo so all text is sharp and readable.",
  216: "Avoid glare — tilt the document slightly or move away from direct light.",
  217: "Follow the on-screen prompts and resubmit the missing items.",
  539: "You have reached the resubmission limit for this session. Start a new verification.",
  602: "Use a passport, driving licence, or national ID card.",
  603: "Complete the video or motion check when prompted.",
  604: "Include both your face and identity document photos.",
  605: "Include a selfie as part of the verification.",
  606: "Make sure your face is fully visible and well lit in the selfie.",
  607: "Include a clear photo of your identity document.",
  608: "Photograph the front of your identity document.",
  609: "Photograph the back of your identity document.",
  610: "Keep fingers and objects away from the document.",
  611: "Make sure the front of the document is fully visible.",
  612: "Make sure the back of the document is fully visible.",
  613: "Move the document so all edges are inside the frame.",
  616: "Avoid glare — tilt the document slightly or move away from direct light.",
  617: "Avoid glare on the front of the document.",
  618: "Avoid glare on the back of the document.",
  619: "Retake the photo so all document details are readable.",
  620: "Use a document that is still valid.",
  621: "Use an undamaged document, or try a different accepted ID type.",
  622: "This document can no longer be used — try another accepted ID type.",
  623: "Use an undamaged document, or try a different accepted ID type.",
  635: "Include both your face and identity document photos.",
};

/** Veriff resubmission limit — same session URL must not be reused. */
export const VERIFF_RESUBMISSION_LIMIT_REASON_CODE = 539;

function readVeriffDecision(decisionPayload: Record<string, unknown> | null): VeriffDecisionFields {
  const verification = decisionPayload?.verification;
  if (!verification || typeof verification !== "object") return {};
  const v = verification as Record<string, unknown>;
  return {
    status: typeof v.status === "string" ? v.status : null,
    reason: typeof v.reason === "string" ? v.reason : null,
    reasonCode: typeof v.reasonCode === "number" ? v.reasonCode : null,
  };
}

function guidanceForReason(reason: string | null, reasonCode: number | null): string | null {
  if (reason?.trim()) return reason.trim();
  if (reasonCode != null && RESUBMISSION_GUIDANCE[reasonCode]) {
    return RESUBMISSION_GUIDANCE[reasonCode];
  }
  return null;
}

function resubmitDetail(reason: string | null, reasonCode: number | null): string {
  const issue = guidanceForReason(reason, reasonCode);
  const guidance =
    reasonCode != null && RESUBMISSION_GUIDANCE[reasonCode]
      ? RESUBMISSION_GUIDANCE[reasonCode]
      : "Use good lighting, keep the document flat, and follow the on-screen prompts.";
  if (issue && issue !== guidance) {
    return `${issue} ${guidance}`;
  }
  return issue ?? guidance;
}

export function readVeriffReasonCode(
  decisionPayload: Record<string, unknown> | null,
): number | null {
  return readVeriffDecision(decisionPayload).reasonCode ?? null;
}

export function readKycCallbackUrl(decisionPayload: Record<string, unknown> | null): string | null {
  const url = decisionPayload?.callbackUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function shouldReuseKycSessionUrl(input: {
  latestSessionStatus: KycVerification["status"] | null;
  decisionPayload: Record<string, unknown> | null;
  expectedCallbackUrl?: string;
}): boolean {
  const sessionUrl = readKycSessionUrl(input.decisionPayload);
  if (!sessionUrl) return false;
  if (
    input.expectedCallbackUrl &&
    readKycCallbackUrl(input.decisionPayload) !== input.expectedCallbackUrl
  ) {
    return false;
  }

  if (input.latestSessionStatus === "created") return true;

  if (input.latestSessionStatus !== "requires_input") return false;
  const reasonCode = readVeriffReasonCode(input.decisionPayload);
  if (reasonCode === VERIFF_RESUBMISSION_LIMIT_REASON_CODE) return false;
  return true;
}

export function readKycSessionUrl(decisionPayload: Record<string, unknown> | null): string | null {
  const url = decisionPayload?.sessionUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function mergeKycDecisionPayload(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const existingPayload = existing ?? null;
  const sessionUrl = readKycSessionUrl(existingPayload) ?? readKycSessionUrl(incoming);
  const callbackUrl = readKycCallbackUrl(existingPayload) ?? readKycCallbackUrl(incoming);
  return {
    ...incoming,
    ...(sessionUrl ? { sessionUrl } : {}),
    ...(callbackUrl ? { callbackUrl } : {}),
  };
}

export function buildKycUserFeedback(input: {
  userStatus: UserKycStatus;
  latestSessionStatus: KycVerification["status"] | null;
  requiresKyc: boolean;
  decisionPayload: Record<string, unknown> | null;
}): KycUserFeedback {
  const { userStatus, latestSessionStatus, requiresKyc, decisionPayload } = input;
  const decision = readVeriffDecision(decisionPayload);
  const reasonCode = decision.reasonCode ?? null;
  const decisionStatus = decision.status ?? null;

  if (userStatus === "approved") {
    return {
      headline: "Verified",
      detail: "Your identity has been verified. You can bid and register for sales.",
      action: "none",
      reasonCode,
      decisionStatus,
      needsResubmit: false,
    };
  }

  if (latestSessionStatus === "requires_input" || decisionStatus === "resubmission_requested") {
    const limitReached = reasonCode === VERIFF_RESUBMISSION_LIMIT_REASON_CODE;
    return {
      headline: limitReached ? "Resubmission limit reached" : "More information needed",
      detail: resubmitDetail(decision.reason ?? null, reasonCode),
      action: limitReached ? "start" : "continue",
      reasonCode,
      decisionStatus: decisionStatus ?? "resubmission_requested",
      needsResubmit: !limitReached,
    };
  }

  if (decisionStatus === "expired") {
    return {
      headline: "Verification expired",
      detail: "Your previous session timed out. Start a new verification when you are ready.",
      action: "start",
      reasonCode,
      decisionStatus,
      needsResubmit: false,
    };
  }

  if (decisionStatus === "abandoned") {
    return {
      headline: "Verification not completed",
      detail:
        "You left the verification flow before finishing. Continue where you left off or start again.",
      action: latestSessionStatus === "created" ? "continue" : "start",
      reasonCode,
      decisionStatus,
      needsResubmit: false,
    };
  }

  if (latestSessionStatus === "created") {
    return {
      headline: "Verification started",
      detail: "Complete the document and selfie checks in the secure window.",
      action: "continue",
      reasonCode,
      decisionStatus,
      needsResubmit: false,
    };
  }

  if (userStatus === "pending" || latestSessionStatus === "processing") {
    return {
      headline: "In review",
      detail: "We are processing your verification. This usually takes a few minutes.",
      action: "wait",
      reasonCode,
      decisionStatus,
      needsResubmit: false,
    };
  }

  if (userStatus === "rejected" || decisionStatus === "declined") {
    const issue = guidanceForReason(decision.reason ?? null, reasonCode);
    return {
      headline: "Verification unsuccessful",
      detail:
        issue ??
        "We could not verify your identity. Try again with clearer photos and a valid document.",
      action: "retry",
      reasonCode,
      decisionStatus: decisionStatus ?? "declined",
      needsResubmit: false,
    };
  }

  return {
    headline: requiresKyc ? "Verification required" : "Not verified",
    detail: requiresKyc
      ? "Identity verification is required before you can place bids at your current exposure."
      : "Required when your bidding exposure reaches our verification threshold.",
    action: "start",
    reasonCode,
    decisionStatus,
    needsResubmit: false,
  };
}
