import type { BuyerOnboardingAnalyticsSource } from "@/lib/analytics/events";
import { trackContextualKycGate } from "@/lib/analytics/events";
import type { ContextualIdentitySource } from "@/lib/kyc/identity-onboarding";

const STORAGE_KEY = "lax_contextual_kyc_return";

export type ContextualKycReturnPending = {
  source: ContextualIdentitySource;
  nextPath: string;
};

const CONTEXTUAL_RETURN_SOURCES = new Set<ContextualIdentitySource>([
  "bid_gate",
  "registration",
  "telephone",
  "condition_report",
]);

export function isContextualReturnSource(
  source: BuyerOnboardingAnalyticsSource,
): source is ContextualIdentitySource {
  return CONTEXTUAL_RETURN_SOURCES.has(source as ContextualIdentitySource);
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return path;
  const queryIndex = path.indexOf("?");
  if (queryIndex === -1) return path;
  return path.slice(0, queryIndex);
}

export function markContextualKycReturnPending(pending: ContextualKycReturnPending): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Ignore storage failures; analytics is best-effort.
  }
}

export function trackContextualKycReturnIfPending(currentPath: string, kycApproved: boolean): void {
  if (typeof window === "undefined" || !kycApproved) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as ContextualKycReturnPending;
    if (normalizePath(currentPath) !== normalizePath(pending.nextPath)) return;
    trackContextualKycGate({ event: "contextual_kyc_returned", source: pending.source });
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore malformed storage payloads.
  }
}
