import type { MarketingAttributionSnapshot } from "./marketing-attribution.js";

/** Marketing / conversion events shared between web dataLayer and API CAPI publishers. */

export const MARKETING_EVENT_NAMES = [
  "BidPlaced",
  "Purchase",
  "InitiateCheckout",
  "CompleteRegistration",
  "Lead",
  "AddToWishlist",
  "RemoveFromWishlist",
] as const;

export type MarketingEventName = (typeof MARKETING_EVENT_NAMES)[number];

export type MarketingActionSource = "website" | "system_generated" | "physical_store";

export type MarketingConsentBasis = "consent" | "legitimate_interest";

export type MarketingEventConsent = {
  marketing: boolean;
  analytics: boolean;
  basis: MarketingConsentBasis;
};

export type MarketingUserRef = { kind: "user"; userId: string } | { kind: "anon"; anonId: string };

/** Browser context for website events (omitted for system_generated webhooks). */
export type MarketingClientContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type MarketingEventBase = {
  eventId: string;
  eventTime: number;
  actionSource: MarketingActionSource;
  userIdOrAnon: MarketingUserRef;
  consent: MarketingEventConsent;
  /** Required by Meta for action_source=website. */
  eventSourceUrl?: string;
  /** Client IP / UA for Event Match Quality (website events only). */
  clientContext?: MarketingClientContext;
  /** Immutable campaign snapshot at event time (consent-based events only). */
  attribution?: MarketingAttributionSnapshot;
};

export type BidPlacedCustomData = {
  lotId: string;
  saleId?: string;
  amountMinor: number;
  currencyCode: string;
};

export type PurchaseCustomData = {
  lotId: string;
  paymentId?: string;
  valueMinor: number;
  currencyCode: string;
};

export type InitiateCheckoutCustomData = {
  lotId: string;
  paymentId?: string;
  valueMinor?: number;
  currencyCode?: string;
};

export type WishlistCustomData = {
  lotId: string;
};

export type LeadCustomData = {
  method?: "email" | "oauth";
};

export type CompleteRegistrationCustomData = {
  kycStatus?: string;
};

export type MarketingEvent =
  | (MarketingEventBase & { name: "BidPlaced"; customData: BidPlacedCustomData })
  | (MarketingEventBase & { name: "Purchase"; customData: PurchaseCustomData })
  | (MarketingEventBase & {
      name: "InitiateCheckout";
      customData: InitiateCheckoutCustomData;
    })
  | (MarketingEventBase & {
      name: "CompleteRegistration";
      customData: CompleteRegistrationCustomData;
    })
  | (MarketingEventBase & { name: "Lead"; customData: LeadCustomData })
  | (MarketingEventBase & { name: "AddToWishlist"; customData: WishlistCustomData })
  | (MarketingEventBase & { name: "RemoveFromWishlist"; customData: WishlistCustomData });

export type ClickIds = {
  fbp?: string;
  fbc?: string;
};

/** Hashed user_data fields for Meta CAPI (no plaintext PII). */
export type HashedUserData = {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  external_id?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type ResolvedMarketingEvent = MarketingEvent & {
  userData: HashedUserData;
};

export type PublishOutcome =
  | { status: "sent"; vendor: "sgtm" | "meta_capi" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string; retryable: boolean };
