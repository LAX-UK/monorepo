import { DASHBOARD_CTA, DASHBOARD_ROUTES, supportMailto } from "@/lib/dashboard/dashboard-copy";

export type LegalEntityAccessContext = "submissions" | "members" | "general";

export type LegalEntityAction = {
  kind: "retry" | "use_personal_profile" | "support" | "navigate";
  label: string;
  href?: string;
};

export type LegalEntityAccessFailure = {
  code: string | null;
  status: number;
  title: string;
  message: string;
  actions: LegalEntityAction[];
};

const NOT_A_MEMBER_MESSAGE =
  "You're no longer an active member of this organisation. Switch to a different organisation from the header.";

export const LEGAL_ENTITY_ERROR_CODES = {
  missing_legal_entity_context: "missing_legal_entity_context",
  not_a_member_of_legal_entity: "not_a_member_of_legal_entity",
  no_valid_legal_entity_for_submissions: "no_valid_legal_entity_for_submissions",
  personal_entity_unavailable: "personal_entity_unavailable",
  impersonation_session_expired: "impersonation_session_expired",
  invalid_impersonation_session: "invalid_impersonation_session",
} as const;

const CODE_MESSAGES: Record<string, string> = {
  missing_legal_entity_context:
    "We couldn't determine which organisation to load. Try switching organisation from the header and reloading.",
  not_a_member_of_legal_entity: NOT_A_MEMBER_MESSAGE,
  impersonation_session_expired:
    "Your impersonation session expired. End impersonation and try again.",
  invalid_impersonation_session:
    "Your impersonation session is no longer valid. End impersonation and try again.",
};

export function describeLegalEntityAccessMessage(status: number, errorCode: string | null): string {
  const byCode = errorCode ? CODE_MESSAGES[errorCode] : undefined;
  if (byCode) return byCode;
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return NOT_A_MEMBER_MESSAGE;
  return "We couldn't verify your organisation access. Refresh and try again.";
}

const SUBMISSIONS_FAILURES: Record<string, Omit<LegalEntityAccessFailure, "code" | "status">> = {
  not_a_member_of_legal_entity: {
    title: "Wrong organisation context",
    message:
      "Your seller workspace is tied to your personal profile. Switch back to your personal account to view and manage submissions.",
    actions: [
      { kind: "use_personal_profile", label: DASHBOARD_CTA.usePersonalProfile },
      { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.seller },
    ],
  },
  no_valid_legal_entity_for_submissions: {
    title: "Seller profile not ready",
    message:
      "We could not finish setting up your seller profile. Try again in a moment. If this keeps happening, contact support.",
    actions: [
      { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.seller },
      {
        kind: "support",
        label: DASHBOARD_CTA.contactSupport,
        href: supportMailto("Seller profile setup"),
      },
    ],
  },
  personal_entity_unavailable: {
    title: "Seller profile not ready",
    message:
      "We could not finish setting up your seller profile. Try again in a moment. If this keeps happening, contact support.",
    actions: [
      { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.seller },
      {
        kind: "support",
        label: DASHBOARD_CTA.contactSupport,
        href: supportMailto("Seller profile setup"),
      },
    ],
  },
  impersonation_session_expired: {
    title: "Impersonation session expired",
    message:
      "Your admin impersonation session ended. End impersonation from the banner and reload.",
    actions: [{ kind: "retry", label: "Reload seller workspace", href: DASHBOARD_ROUTES.seller }],
  },
  invalid_impersonation_session: {
    title: "Impersonation session invalid",
    message:
      "Your admin impersonation session is no longer valid. End impersonation and try again.",
    actions: [{ kind: "retry", label: "Reload seller workspace", href: DASHBOARD_ROUTES.seller }],
  },
};

export function buildLegalEntityAccessFailure(
  context: LegalEntityAccessContext,
  status: number,
  code: string | null,
): LegalEntityAccessFailure {
  if (context === "submissions" && code && SUBMISSIONS_FAILURES[code]) {
    return { code, status, ...SUBMISSIONS_FAILURES[code] };
  }
  if (context === "submissions") {
    return {
      code,
      status,
      title: "Could not load submissions",
      message:
        status === 401
          ? "Your session expired. Sign in again to view your submissions."
          : "Something went wrong while loading your submissions. Try again.",
      actions: [
        { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.submissions },
        { kind: "navigate", label: DASHBOARD_CTA.sellerWorkspace, href: DASHBOARD_ROUTES.seller },
      ],
    };
  }
  return {
    code,
    status,
    title: context === "members" ? "Could not load members" : "Organisation access issue",
    message: describeLegalEntityAccessMessage(status, code),
    actions: [
      { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.organisations },
    ],
  };
}

export function isLegalEntityAccessCode(code: string | null): boolean {
  if (!code) return false;
  return (
    code in CODE_MESSAGES ||
    code === LEGAL_ENTITY_ERROR_CODES.no_valid_legal_entity_for_submissions ||
    code === LEGAL_ENTITY_ERROR_CODES.personal_entity_unavailable
  );
}
