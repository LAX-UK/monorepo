/** Zoho CRM field API names agreed for the LAX integration sandbox. */
export const CRM_FIELD = {
  subjectExternalId: "LAX_Subject_ID",
  dealExternalKey: "LAX_Deal_Key",
  leadStatus: "Lead_Status",
  leadSource: "Lead_Source",
  leadSourceDetailed: "Lead_Source_Detailed",
  eligibilityBid: "Eligibility_LAX_Bid",
  eligibilityArt: "Eligibility_LAX_Art",
  utmSource: "UTM_Source",
  utmMedium: "UTM_Medium",
  utmCampaign: "UTM_Campaign",
  utmContent: "UTM_Content",
  utmTerm: "UTM_Term",
  landingPageUrl: "Landing_Page_URL",
  /** Zoho's standard opt-out flag: true unless the person opted in to marketing. */
  emailOptOut: "Email_Opt_Out",
  /** What an enquirer asked for: sell privately, buy privately or a general question. */
  enquiryIntent: "LAX_Enquiry_Intent",
  enquiryDepartment: "LAX_Department",
  /** The owners' Enquiry Type picklist: Original, Prints, Auction, Corporate or General. */
  enquiryType: "Enquiry_Type",
  interestedArtist: "Interested_Artist",
  interestedCollection: "Interested_Collection",
  consentMarketingOptIn: "Consent_Marketing_Opt_In",
  consentTimestamp: "Consent_Timestamp",
  consentSource: "Consent_Source",
  consentWordingVersion: "Consent_Wording_Version",
  dataProcessingNoticeConfirmed: "Data_Processing_Notice_Confirmed",
  /** The reference the sender quotes, for example E-1001. */
  enquiryReference: "LAX_Enquiry_Reference",
} as const;

/** Lead Source (Primary) for everything the website creates. */
export const CRM_LEAD_SOURCE_WEBSITE = "Website";
/** Consent Source for consent recorded on a website form. */
export const CRM_CONSENT_SOURCE_WEBSITE = "Website";

/** Lead_Status values the platform reads or sets. Any other status is an admin's and is left alone. */
export const CRM_LEAD_STATUS = {
  qualified: "Qualified",
  /** Statuses a paying buyer's lead may be moved up from. */
  upgradableToQualified: ["New", "New (Unassigned)", "Assigned", "Contacted"],
} as const;

/** Fields that exist on Leads only; they are not sent when the person is already a Contact. */
export const CRM_LEAD_ONLY_FIELDS: readonly string[] = [
  CRM_FIELD.leadStatus,
  CRM_FIELD.leadSource,
  CRM_FIELD.leadSourceDetailed,
  CRM_FIELD.enquiryType,
  CRM_FIELD.interestedArtist,
  CRM_FIELD.interestedCollection,
  CRM_FIELD.consentMarketingOptIn,
  CRM_FIELD.consentTimestamp,
  CRM_FIELD.consentSource,
  CRM_FIELD.consentWordingVersion,
  CRM_FIELD.dataProcessingNoticeConfirmed,
];

/** Lead Source (Detailed) is the product and the form the person used. */
export const CRM_LEAD_SOURCE_SIGN_UP = "LAX Account sign-up";
export const CRM_LEAD_SOURCE_BID_ENQUIRY = "LAX Bid enquiry";
export const CRM_LEAD_SOURCE_BID_PRIVATE_SALE_ENQUIRY = "LAX Bid private sale enquiry";
export const CRM_LEAD_SOURCE_SHOP_GUEST = "LAX Shop guest";
/** Detailed source of a signed-in person's enquiry about a Shop or lax.art original. */
export const CRM_LEAD_SOURCE_SHOP_ENQUIRY = "LAX Shop enquiry";

export const CRM_ENTITY = {
  subject: "subject",
  deal: "deal",
  note: "note",
  task: "task",
} as const;

export function lotWonDealEntityId(lotId: string): string {
  return `lot-won:${lotId}`;
}

export function shopOrderDealEntityId(orderId: string): string {
  return `shop-order:${orderId}`;
}

/** Ledger id of the purchase note or the "please convert" task for one deal. */
export function paidCustomerRecordId(dealEntityId: string): string {
  return `paid-customer:${dealEntityId}`;
}

export function lotWonDealKey(lotId: string): string {
  return `lot-won:${lotId}`;
}

export function shopOrderDealKey(orderId: string): string {
  return `shop-order:${orderId}`;
}
