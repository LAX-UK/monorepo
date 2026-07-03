import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "kyc-resubmission-required",
  "aml-compliance-review-notice",
  "source-of-funds-buyer-notice",
  "source-of-funds-documents-requested",
  "source-of-funds-approved",
  "source-of-funds-rejected",
] as const;

type ComplianceTemplateName = (typeof names)[number];

type ComplianceTemplateVars = {
  "kyc-resubmission-required": {
    userName?: string | null;
    issueDetail?: string | null;
    verifyUrl: string;
  };
  /**
   * MLRO / compliance escalation for a sanctions/PEP/adverse-media match or a
   * Source-of-Funds case requiring review. Deliberately PII-light (references +
   * a short detail line); full context lives behind the admin review queue.
   */
  "aml-compliance-review-notice": {
    recipientFirstName?: string | null;
    /** "screening" (watchlist match) or "source_of_funds". */
    kind: "screening" | "source_of_funds";
    /** Screening id or Source-of-Funds case id. */
    caseReference: string;
    detail: string;
    adminReviewUrl: string;
    supportContactEmail: string;
  };
  "source-of-funds-buyer-notice": {
    userName?: string | null;
    supportContactEmail: string;
    settlementSummary?: string | null;
  };
  "source-of-funds-documents-requested": {
    userName?: string | null;
    documentTypes: string[];
    requestNote?: string | null;
    uploadUrl: string;
    settlementSummary?: string | null;
    supportContactEmail: string;
  };
  "source-of-funds-approved": {
    userName?: string | null;
    settlementSummary?: string | null;
    dashboardUrl: string;
    supportContactEmail: string;
  };
  "source-of-funds-rejected": {
    userName?: string | null;
    settlementSummary?: string | null;
    dashboardUrl: string;
    supportContactEmail: string;
  };
};

export const complianceTemplates = {
  names,
  vars: {} as ComplianceTemplateVars,
  recipientResolution: {
    "kyc-resubmission-required": "live",
    "aml-compliance-review-notice": "live",
    "source-of-funds-buyer-notice": "live",
    "source-of-funds-documents-requested": "live",
    "source-of-funds-approved": "live",
    "source-of-funds-rejected": "live",
  },
} satisfies TemplateDomainSlice<ComplianceTemplateName, ComplianceTemplateVars>;

export type { ComplianceTemplateName, ComplianceTemplateVars };
