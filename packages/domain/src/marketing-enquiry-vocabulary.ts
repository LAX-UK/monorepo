/** What a visitor is asking for. The first three are the enquiry page's paths; the rest are the contact form's topics. */
export const ENQUIRY_INTENTS = [
  "general",
  "private_sale_sell",
  "private_sale_buy",
  "buying",
  "selling",
  "shipping",
  "press",
] as const;
export type EnquiryIntent = (typeof ENQUIRY_INTENTS)[number];

export const PRIVATE_SALE_ENQUIRY_INTENTS = ["private_sale_sell", "private_sale_buy"] as const;
export type PrivateSaleEnquiryIntent = (typeof PRIVATE_SALE_ENQUIRY_INTENTS)[number];

export function isPrivateSaleEnquiryIntent(intent: string): intent is PrivateSaleEnquiryIntent {
  return (PRIVATE_SALE_ENQUIRY_INTENTS as readonly string[]).includes(intent);
}

export const ENQUIRY_STATUSES = [
  "new",
  "in_progress",
  "waiting_on_client",
  "converted",
  "closed",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** Statuses that still need someone's attention. */
export const OPEN_ENQUIRY_STATUSES: readonly EnquiryStatus[] = [
  "new",
  "in_progress",
  "waiting_on_client",
];

export const ENQUIRY_CLOSE_REASONS = [
  "not_a_fit",
  "not_proceeding",
  "sold_elsewhere",
  "duplicate",
  "spam",
] as const;
export type EnquiryCloseReason = (typeof ENQUIRY_CLOSE_REASONS)[number];

export const ENQUIRY_BUDGET_BANDS = [
  "under_10000",
  "10000_to_50000",
  "50000_to_250000",
  "over_250000",
  "prefer_not_to_say",
] as const;
export type EnquiryBudgetBand = (typeof ENQUIRY_BUDGET_BANDS)[number];

export const ENQUIRY_TIMINGS = ["no_rush", "within_3_months", "urgent"] as const;
export type EnquiryTiming = (typeof ENQUIRY_TIMINGS)[number];

export const ENQUIRY_CONTACT_PREFERENCES = ["email", "phone", "either"] as const;
export type EnquiryContactPreference = (typeof ENQUIRY_CONTACT_PREFERENCES)[number];

/** The line the enquiry page used to put at the start of a private sale message. */
export const LEGACY_PRIVATE_SALE_MESSAGE_TAG = "Private sale enquiry";

/**
 * The intent of an enquiry sent without one, from its contact form topic and message. A message
 * that opens with the private sale tag is a private sale enquiry: selling or buying by topic.
 */
export function deriveLegacyEnquiryIntent(input: {
  topic: string;
  message: string;
}): EnquiryIntent {
  if (input.message.startsWith(LEGACY_PRIVATE_SALE_MESSAGE_TAG)) {
    return input.topic === "selling" ? "private_sale_sell" : "private_sale_buy";
  }
  if (input.topic === "other") return "general";
  return (ENQUIRY_INTENTS as readonly string[]).includes(input.topic)
    ? (input.topic as EnquiryIntent)
    : "general";
}
