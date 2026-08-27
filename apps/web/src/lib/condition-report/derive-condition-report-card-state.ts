import type {
  ConditionReportRequestSnapshot,
  PublishedConditionReport,
} from "@/lib/condition-report/condition-report-types";
import {
  type SelfServiceActorKycStatus,
  evaluateSelfServiceActorIdentityEligibility,
} from "@auction/domain";

export type ConditionReportCardState =
  | { kind: "published"; summary: string | null; downloadUrl: string }
  | { kind: "notSignedIn"; loginNextPath: string }
  | { kind: "emailVerificationRequired"; loginNextPath: string; email: string | null }
  | { kind: "kycRequired"; loginNextPath: string; feedback: string | null }
  | { kind: "canRequest" }
  | { kind: "submitting" }
  | { kind: "submitError"; message: string };

export type DeriveConditionReportCardInput = {
  show: boolean;
  isAuthenticated: boolean;
  emailVerified: boolean;
  userEmail: string | null;
  kycStatus: SelfServiceActorKycStatus;
  kycFeedback: string | null;
  loginNextPath: string;
  published: PublishedConditionReport | null;
  buyerRequest: ConditionReportRequestSnapshot | null;
  uiPhase: "idle" | "submitting" | "submitError";
  submitErrorMessage: string | null;
};

function isHttpsUrl(url: string | null | undefined): url is string {
  if (!url || url.trim() === "") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function deriveConditionReportCardState(
  input: DeriveConditionReportCardInput,
): ConditionReportCardState | null {
  if (!input.show) return null;

  const publishedUrl = input.published?.downloadUrl ?? null;
  if (isHttpsUrl(publishedUrl)) {
    return {
      kind: "published",
      summary: input.published?.summary?.trim() ? input.published.summary.trim() : null,
      downloadUrl: publishedUrl,
    };
  }

  if (!input.isAuthenticated) {
    return { kind: "notSignedIn", loginNextPath: input.loginNextPath };
  }

  const eligibility = evaluateSelfServiceActorIdentityEligibility({
    emailVerified: input.emailVerified,
    kycStatus: input.kycStatus,
  });
  if (eligibility.kind === "ineligible") {
    if (eligibility.code === "email_not_verified") {
      return {
        kind: "emailVerificationRequired",
        loginNextPath: input.loginNextPath,
        email: input.userEmail,
      };
    }
    return {
      kind: "kycRequired",
      loginNextPath: input.loginNextPath,
      feedback: input.kycFeedback,
    };
  }

  if (input.buyerRequest) {
    return null;
  }

  if (input.uiPhase === "submitting") {
    return { kind: "submitting" };
  }
  if (input.uiPhase === "submitError" && input.submitErrorMessage) {
    return { kind: "submitError", message: input.submitErrorMessage };
  }

  return { kind: "canRequest" };
}
