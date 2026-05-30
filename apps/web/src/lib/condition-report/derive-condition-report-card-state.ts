import type {
  ConditionReportRequestSnapshot,
  PublishedConditionReport,
} from "@/lib/condition-report/condition-report-types";

export type ConditionReportCardState =
  | { kind: "published"; summary: string | null; downloadUrl: string }
  | { kind: "notSignedIn"; loginNextPath: string }
  | { kind: "kycRequired"; loginNextPath: string; feedback: string | null }
  | { kind: "canRequest" }
  | { kind: "submitting" }
  | { kind: "submitError"; message: string };

export type DeriveConditionReportCardInput = {
  show: boolean;
  lotEligible: boolean;
  isAuthenticated: boolean;
  kycApproved: boolean;
  kycFeedback: string | null;
  loginNextPath: string;
  dashboardHref: string;
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

  if (!input.kycApproved) {
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

  if (!input.lotEligible) {
    return null;
  }

  return { kind: "canRequest" };
}
