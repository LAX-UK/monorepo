"use client";

import type { MarketingEventName } from "@auction/types";
import { readConsentFromDocument } from "./consent-headers";
import { isConsentBannerDisabled } from "./consent/disable-banner";
import { isAnalyticsEnabled } from "./is-enabled";

type DataLayerEvent = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

/**
 * When the URL carries `?gtm_debug=…` or `?debug_mode=1`, attach `debug_mode: 1`
 * to every dataLayer event. The Google tag forwards this to GA4 which routes the
 * hit to DebugView (Admin → DebugView), making it trivial to verify tags
 * end-to-end without a full GTM Preview session.
 *
 * Sticky for the rest of the session via sessionStorage so DebugView keeps
 * working across client-side navigations after the flag is dropped from the URL.
 */
function isGa4DebugSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("gtm_debug") || params.get("debug_mode") === "1") {
      window.sessionStorage.setItem("lax_ga4_debug", "1");
      return true;
    }
    return window.sessionStorage.getItem("lax_ga4_debug") === "1";
  } catch {
    return false;
  }
}

function pushDataLayer(payload: DataLayerEvent): string {
  if (typeof window === "undefined") return payload.event_id as string;
  window.dataLayer = window.dataLayer ?? [];
  const enriched = isGa4DebugSession() ? { ...payload, debug_mode: 1 } : payload;
  window.dataLayer.push(enriched);
  return String(payload.event_id);
}

function newEventId(): string {
  return crypto.randomUUID();
}

function consentAllowsMarketing(): boolean {
  const c = readConsentFromDocument();
  return c?.marketing === true;
}

function consentAllowsAnalytics(): boolean {
  const c = readConsentFromDocument();
  return c?.analytics === true;
}

function guardConversion(): boolean {
  if (!isAnalyticsEnabled()) return false;
  // TEMPORARY (PRE-LAUNCH TESTING ONLY): bypass consent guards when banner is disabled.
  // REMOVE BEFORE GOING LIVE — violates UK GDPR/PECR if left enabled in production.
  if (isConsentBannerDisabled()) return true;
  return consentAllowsMarketing() && consentAllowsAnalytics();
}

function guardAnalytics(): boolean {
  if (!isAnalyticsEnabled()) return false;
  // TEMPORARY (PRE-LAUNCH TESTING ONLY): bypass consent guards when banner is disabled.
  // REMOVE BEFORE GOING LIVE — violates UK GDPR/PECR if left enabled in production.
  if (isConsentBannerDisabled()) return true;
  return consentAllowsAnalytics();
}

export type TrackViewItemInput = {
  lotId: string;
  title: string;
  priceMinor?: number;
  currency?: string;
};

export function trackPageView(path: string): string | null {
  if (!guardAnalytics()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "page_view",
    event_id: eventId,
    page_path: path,
  });
  return eventId;
}

export function trackViewItem(input: TrackViewItemInput): string | null {
  if (!guardAnalytics()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "view_item",
    event_id: eventId,
    items: [
      {
        item_id: input.lotId,
        item_name: input.title,
        ...(input.priceMinor != null ? { price: input.priceMinor / 100 } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
      },
    ],
  });
  return eventId;
}

export function trackViewItemList(input: {
  listId: string;
  listName: string;
  itemIds: string[];
}): string | null {
  if (!guardAnalytics()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "view_item_list",
    event_id: eventId,
    item_list_id: input.listId,
    item_list_name: input.listName,
    items: input.itemIds.map((id) => ({ item_id: id })),
  });
  return eventId;
}

export function trackSearch(query: string): string | null {
  if (!guardAnalytics()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "search",
    event_id: eventId,
    search_term: query,
  });
  return eventId;
}

export function trackSignUp(): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  pushDataLayer({ event: "sign_up", event_id: eventId, method: "email" });
  return eventId;
}

export function trackLogin(): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  pushDataLayer({ event: "login", event_id: eventId, method: "email" });
  return eventId;
}

export function trackAddToWishlist(lotId: string): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "add_to_wishlist",
    event_id: eventId,
    items: [{ item_id: lotId }],
  });
  return eventId;
}

export function trackBidPlaced(input: {
  lotId: string;
  amount: number;
  currency?: string;
}): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "bid_placed",
    event_id: eventId,
    items: [{ item_id: input.lotId }],
    value: input.amount,
    currency: input.currency ?? "GBP",
  });
  return eventId;
}

export function trackBeginCheckout(input: {
  lotId: string;
  valueMinor?: number;
  currency?: string;
}): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  const currency = input.currency ?? "GBP";
  pushDataLayer({
    event: "begin_checkout",
    event_id: eventId,
    items: [{ item_id: input.lotId }],
    ...(input.valueMinor != null ? { value: input.valueMinor / 100, currency } : {}),
  });
  return eventId;
}

export function trackPurchase(input: {
  lotId: string;
  valueMinor: number;
  currency?: string;
  transactionId?: string;
}): string | null {
  if (!guardConversion()) return null;
  const eventId = newEventId();
  pushDataLayer({
    event: "purchase",
    event_id: eventId,
    transaction_id: input.transactionId,
    items: [{ item_id: input.lotId }],
    value: input.valueMinor / 100,
    currency: input.currency ?? "GBP",
  });
  return eventId;
}

export type { MarketingEventName };
