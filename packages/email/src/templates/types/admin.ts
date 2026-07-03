import type { TemplateDomainSlice } from "./shared.js";

const names = ["admin-impersonation-notice", "lot-voided-anti-shilling-admin"] as const;

type AdminTemplateName = (typeof names)[number];

type AdminTemplateVars = {
  "admin-impersonation-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    adminDisplayName: string;
    windowEndDisplay: string;
    supportContactEmail: string;
  };
  "lot-voided-anti-shilling-admin": {
    lotTitle: string;
    lotId: string;
    adminLotUrl: string;
    supportContactEmail: string;
  };
};

export const adminTemplates = {
  names,
  vars: {} as AdminTemplateVars,
  recipientResolution: {
    "admin-impersonation-notice": "live",
    "lot-voided-anti-shilling-admin": "live",
  },
} satisfies TemplateDomainSlice<AdminTemplateName, AdminTemplateVars>;

export type { AdminTemplateName, AdminTemplateVars };
