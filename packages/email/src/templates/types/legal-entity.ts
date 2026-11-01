import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "legal-entity-archived-notice",
  "legal-entity-submitted-admin-notice",
  "legal-entity-approved-notice",
  "legal-entity-rejected-notice",
  "legal-entity-docs-requested-notice",
  "organisation-membership-ended-notice",
  "access-requested-notice",
  "access-request-decided-notice",
  "two-step-reminder-notice",
] as const;

type LegalEntityTemplateName = (typeof names)[number];

type LegalEntityTemplateVars = {
  "legal-entity-archived-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    legalEntityId: string;
    dashboardUrl: string;
    supportContactEmail: string;
  };
  "legal-entity-submitted-admin-notice": {
    entityName: string;
    legalEntityId: string;
    adminOnboardingUrl: string;
    supportContactEmail: string;
  };
  "legal-entity-approved-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    legalEntityId: string;
    dashboardUrl: string;
    connectUrl: string;
    supportContactEmail: string;
  };
  "legal-entity-rejected-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    legalEntityId: string;
    rejectionReason?: string | null;
    dashboardUrl: string;
    supportContactEmail: string;
  };
  "legal-entity-docs-requested-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    legalEntityId: string;
    docsUrl: string;
    supportContactEmail: string;
  };
  /** Tells someone an owner or admin removed them from an organisation. */
  "organisation-membership-ended-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    bidUrl: string;
    supportContactEmail: string;
    /** The automatic bids for the organisation that stopped with the removal. */
    stoppedBids?: { lotTitle: string; kind: "auto_bid" | "absentee" }[];
  };
  /** Tells every owner and admin that a member asked for a role or more access. */
  "access-requested-notice": {
    recipientFirstName?: string | null;
    requesterName: string;
    entityName: string;
    /** What was asked for, in words: "the Buyer agent role", "more access". */
    requested: string;
    reason?: string | null;
    teamUrl: string;
  };
  /** Tells the member who asked what an owner or admin decided. */
  "access-request-decided-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    approved: boolean;
    /** The role given, in words, when approved. */
    grantedRole?: string | null;
    note?: string | null;
    workspaceUrl: string;
  };
  /** Asks a member without two-step verification to turn it on, from an owner or admin. */
  "two-step-reminder-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    senderName: string;
    /** The organisation requires two-step, so acting for it waits until it is on. */
    required: boolean;
    securityUrl: string;
  };
};

export const legalEntityTemplates = {
  names,
  vars: {} as LegalEntityTemplateVars,
  recipientResolution: {
    "legal-entity-archived-notice": "live",
    "legal-entity-submitted-admin-notice": "live",
    "legal-entity-approved-notice": "live",
    "legal-entity-rejected-notice": "live",
    "legal-entity-docs-requested-notice": "live",
    "organisation-membership-ended-notice": "live",
    "access-requested-notice": "live",
    "access-request-decided-notice": "live",
    "two-step-reminder-notice": "live",
  },
} satisfies TemplateDomainSlice<LegalEntityTemplateName, LegalEntityTemplateVars>;

export type { LegalEntityTemplateName, LegalEntityTemplateVars };
