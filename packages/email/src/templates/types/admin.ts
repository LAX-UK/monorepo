import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "admin-impersonation-notice",
  "lot-voided-anti-shilling-admin",
  "staff-role-expired",
  "staff-role-changed",
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
    /** The admin the role belongs to ("Bid", "LAX Admin"); Bid when absent. */
    productLabel?: string;
  };
  /** A staff role was given or removed; sent to the person and to the admin's administrators. */
  "staff-role-changed": {
    recipient: "person" | "administrator";
    recipientFirstName?: string | null;
    change: "given" | "removed";
    /** Whose role changed; shown to administrators. */
    staffName: string;
    roleLabel: string;
    /** The admin the role belongs to ("LAX Admin"). */
    productLabel: string;
    /** Who made the change. */
    changedByName?: string | null;
    /** The last day of a role given with an end date, formatted in London time. */
    endsOnDisplay?: string | null;
    /** The reason given for the change. */
    reason?: string | null;
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
    "staff-role-changed": "live",
  },
} satisfies TemplateDomainSlice<AdminTemplateName, AdminTemplateVars>;

export type { AdminTemplateName, AdminTemplateVars };
