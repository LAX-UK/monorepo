import type { TemplateDomainSlice } from "./shared.js";

const names = ["bid-enquiry-received"] as const;

type EnquiryTemplateName = (typeof names)[number];

type EnquiryTemplateVars = {
  /** The sender's copy of an enquiry sent on lax.bid: its reference and when to expect a reply. */
  "bid-enquiry-received": {
    /** What the sender quotes: E-1042. */
    reference: string;
    recipientName?: string | undefined;
    kind: "sell" | "buy" | "general";
    /** The contact form topic of a general enquiry ("Press"). */
    topicLabel?: string | undefined;
    /** The department a seller chose. */
    departmentLabel?: string | undefined;
    /** The artist and title a seller named. Never a price. */
    work?: string | undefined;
    /** How many photos and documents arrived with a seller's enquiry. */
    photoCount?: number | undefined;
    /** ISO time by which the sender was promised a reply. */
    replyBy: string;
    /** The privacy notice, for the footer. */
    privacyUrl: string;
    /** Where the sender writes to add something, quoting the reference. */
    contactEmail: string;
  };
};

export const enquiryTemplates = {
  names,
  vars: {} as EnquiryTemplateVars,
  recipientResolution: { "bid-enquiry-received": "snapshot" },
} satisfies TemplateDomainSlice<EnquiryTemplateName, EnquiryTemplateVars>;

export type { EnquiryTemplateName, EnquiryTemplateVars };
