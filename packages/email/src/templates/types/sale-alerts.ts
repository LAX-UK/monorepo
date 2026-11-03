import type { TemplateDomainSlice } from "./shared.js";

const names = ["visitor-alert-confirm"] as const;

type SaleAlertTemplateName = (typeof names)[number];

type SaleAlertTemplateVars = {
  "visitor-alert-confirm": {
    /** Opens the page that switches new-sale alerts on for the address. */
    confirmUrl: string;
    /** Hours the confirmation link works for. */
    expirationHours: number;
    /** Stops the alerts without signing in; also sent as the one-click List-Unsubscribe header. */
    unsubscribeUrl: string;
    /** The one-click (POST) address for the List-Unsubscribe header. */
    listUnsubscribeUrl?: string;
  };
};

export const saleAlertTemplates = {
  names,
  vars: {} as SaleAlertTemplateVars,
  recipientResolution: {
    // The person has no account: the address is kept only on the outbox row, then purged.
    "visitor-alert-confirm": "snapshot",
  },
} satisfies TemplateDomainSlice<SaleAlertTemplateName, SaleAlertTemplateVars>;

export type { SaleAlertTemplateName, SaleAlertTemplateVars };
