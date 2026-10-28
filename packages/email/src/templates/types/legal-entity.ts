import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "legal-entity-archived-notice",
  "legal-entity-submitted-admin-notice",
  "legal-entity-approved-notice",
  "legal-entity-rejected-notice",
  "legal-entity-docs-requested-notice",
  "organisation-membership-ended-notice",
  "organisation-bid-cancelled-notice",
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
  };
  /** Tells a former member the organisation cancelled a bid they left standing for it. */
  "organisation-bid-cancelled-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    lotTitle: string;
    bidKind: "auto_bid" | "absentee";
    supportContactEmail: string;
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
    "organisation-bid-cancelled-notice": "live",
  },
} satisfies TemplateDomainSlice<LegalEntityTemplateName, LegalEntityTemplateVars>;

export type { LegalEntityTemplateName, LegalEntityTemplateVars };
