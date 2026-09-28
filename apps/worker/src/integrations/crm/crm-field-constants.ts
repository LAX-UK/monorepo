/** Zoho CRM field API names agreed for the LAX integration sandbox. */
export const CRM_FIELD = {
  subjectExternalId: "LAX_Subject_ID",
  dealExternalKey: "LAX_Deal_Key",
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
} as const;

export const CRM_LEAD_SOURCE_PLATFORM = "LAX Platform";

export const CRM_ENTITY = {
  subject: "subject",
  deal: "deal",
} as const;

export function lotWonDealEntityId(lotId: string): string {
  return `lot-won:${lotId}`;
}

export function shopOrderDealEntityId(orderId: string): string {
  return `shop-order:${orderId}`;
}

export function lotWonDealKey(lotId: string): string {
  return `lot-won:${lotId}`;
}

export function shopOrderDealKey(orderId: string): string {
  return `shop-order:${orderId}`;
}
