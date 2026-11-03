import type { TemplateDomainSlice } from "./shared.js";

const names = ["alert-confirm", "alert-digest"] as const;

type AlertTemplateName = (typeof names)[number];

/** The products that send alert emails. */
export type AlertEmailProduct = "bid" | "shop" | "art";

export type AlertDigestItem = {
  title: string;
  subtitle?: string;
  detail?: string;
  imageUrl?: string;
  /** Absolute link to the item. */
  url: string;
};

export type AlertDigestGroup = {
  heading: string;
  /** Every match in the group, including those past the items listed. */
  total: number;
  subgroups: { label?: string; criteria?: string; items: AlertDigestItem[] }[];
  /** Set when some matches are not listed: where to see all of them. */
  more?: { url: string; label: string };
};

type AlertTemplateVars = {
  /** Double opt-in: the press that turns a request into a subscription. Sent at once. */
  "alert-confirm": {
    product: AlertEmailProduct;
    /** "Confirm your LAX Bid sale alerts". */
    subject: string;
    title: string;
    intro: string;
    buttonLabel: string;
    confirmUrl: string;
    expirationHours: number;
    /** Where the address was entered, for the footer: "the LAX Bid sale alerts form". */
    sourceName: string;
    /** Stops the alerts without signing in; the footer link. */
    unsubscribeUrl: string;
    /** The one-click (POST) address for the List-Unsubscribe header. */
    listUnsubscribeUrl: string;
    stopLabel: string;
  };
  /** The daily digest: everything that matched since the last one, in one email. */
  "alert-digest": {
    product: AlertEmailProduct;
    subject: string;
    title: string;
    /** "Wednesday 4 November": the London day the digest is for. */
    dateLabel: string;
    groups: AlertDigestGroup[];
    /** Why the person gets this, in the product's words. */
    reason: string;
    /** Set for a visitor, who has no account: names the address the email went to. */
    address?: string;
    /** Where an account holder manages alerts; absent for a visitor. */
    manageUrl?: string;
    unsubscribeUrl: string;
    listUnsubscribeUrl: string;
    stopLabel: string;
  };
};

export const saleAlertTemplates = {
  names,
  vars: {} as AlertTemplateVars,
  recipientResolution: {
    // A visitor has no account: the address is kept only on the outbox row, then purged.
    "alert-confirm": "snapshot",
    "alert-digest": "snapshot",
  },
} satisfies TemplateDomainSlice<AlertTemplateName, AlertTemplateVars>;

export type { AlertTemplateName, AlertTemplateVars };
