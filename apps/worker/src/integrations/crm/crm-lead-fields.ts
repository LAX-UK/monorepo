import {
  CRM_CONSENT_SOURCE_WEBSITE,
  CRM_FIELD,
  CRM_LEAD_SOURCE_WEBSITE,
} from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";

/** The owners' Enquiry Type picklist. */
export type CrmEnquiryType = "Original" | "Prints" | "Auction" | "Corporate" | "General";

const ENQUIRY_TYPE_BY_INTENT: Readonly<Record<string, CrmEnquiryType>> = {
  private_sale_buy: "Original",
  buying: "Original",
  private_sale_sell: "Auction",
  selling: "Auction",
};

const ENQUIRY_TYPE_BY_DEPARTMENT: Readonly<Record<string, CrmEnquiryType>> = {
  prints: "Prints",
  editions: "Prints",
  corporate: "Corporate",
  "corporate-collections": "Corporate",
  auction: "Auction",
  auctions: "Auction",
};

/** Enquiry Type from what the sender asked for; the department decides when it names one. */
export function enquiryTypeFor(intent: string, departmentSlug: string | null): CrmEnquiryType {
  if (departmentSlug) {
    const byDepartment = ENQUIRY_TYPE_BY_DEPARTMENT[departmentSlug.toLowerCase()];
    if (byDepartment) return byDepartment;
  }
  return ENQUIRY_TYPE_BY_INTENT[intent] ?? "General";
}

/**
 * What a lead starts with when the platform creates it. Status and primary source are an admin's
 * once the lead exists, so they are sent on creation only.
 */
export function newLeadFields(leadStatusNew: string): Record<string, CrmFieldValue> {
  return {
    [CRM_FIELD.leadStatus]: leadStatusNew,
    [CRM_FIELD.leadSource]: CRM_LEAD_SOURCE_WEBSITE,
  };
}

/** Fields every website lead carries: which product and form it came from, and what it is about. */
export function websiteLeadFields(input: {
  detailedSource: string;
  enquiryType: CrmEnquiryType;
}): Record<string, CrmFieldValue> {
  return {
    [CRM_FIELD.leadSourceDetailed]: input.detailedSource.slice(0, 255),
    [CRM_FIELD.enquiryType]: input.enquiryType,
  };
}

/**
 * Consent exactly as the platform recorded it. Without an opt-in nothing but the "not opted in"
 * flag is sent, so a person is never marked as opted in by default.
 */
export function consentFields(input: {
  optIn: boolean;
  /** When the person opted in; Zoho's Consent Timestamp holds a date. */
  at: Date | string | null;
  wordingVersion?: string | null;
}): Record<string, CrmFieldValue> {
  const fields: Record<string, CrmFieldValue> = {
    [CRM_FIELD.consentMarketingOptIn]: input.optIn,
    [CRM_FIELD.emailOptOut]: !input.optIn,
  };
  if (!input.optIn) return fields;
  const at = input.at === null ? null : new Date(input.at);
  if (at && !Number.isNaN(at.getTime())) {
    fields[CRM_FIELD.consentTimestamp] = at.toISOString().slice(0, 10);
  }
  fields[CRM_FIELD.consentSource] = CRM_CONSENT_SOURCE_WEBSITE;
  if (input.wordingVersion) fields[CRM_FIELD.consentWordingVersion] = input.wordingVersion;
  return fields;
}

/** Set on the form that showed the privacy notice. */
export function noticeConfirmedFields(): Record<string, CrmFieldValue> {
  return { [CRM_FIELD.dataProcessingNoticeConfirmed]: true };
}

/** Interest: Artist, when the person named one. */
export function interestFields(
  artistName: string | null | undefined,
): Record<string, CrmFieldValue> {
  const artist = artistName?.trim();
  return artist ? { [CRM_FIELD.interestedArtist]: artist.slice(0, 255) } : {};
}
