import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "legal-entity-archived-notice",
  "legal-entity-submitted-admin-notice",
  "legal-entity-approved-notice",
  "legal-entity-rejected-notice",
  "legal-entity-docs-requested-notice",
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
  },
} satisfies TemplateDomainSlice<LegalEntityTemplateName, LegalEntityTemplateVars>;

export type { LegalEntityTemplateName, LegalEntityTemplateVars };
