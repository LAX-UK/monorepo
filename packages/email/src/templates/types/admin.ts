import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "admin-impersonation-notice",
  "lot-voided-anti-shilling-admin",
  "staff-role-expired",
] as const;

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
  /** A Bid staff role ended on its end date; sent to the person and to each administrator. */
  "staff-role-expired": {
    recipient: "person" | "administrator";
    recipientFirstName?: string | null;
    /** Whose role ended; shown to administrators. */
    staffName: string;
    roleLabel: string;
    /** The end date, already formatted in London time. */
    endedOnDisplay: string;
    /** Administrators only: where to review staff access. */
    adminStaffAccessUrl?: string | null;
  };
};

export const adminTemplates = {
  names,
  vars: {} as AdminTemplateVars,
  recipientResolution: {
    "admin-impersonation-notice": "live",
    "lot-voided-anti-shilling-admin": "live",
    "staff-role-expired": "live",
  },
} satisfies TemplateDomainSlice<AdminTemplateName, AdminTemplateVars>;

export type { AdminTemplateName, AdminTemplateVars };
