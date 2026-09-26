"use client";

import { trackLogin, trackSilentSignInResult } from "@/lib/analytics/events";
import { trackSellAuthHandoff } from "@/lib/analytics/sell-funnel";
import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import { clearClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";

/** Client-side effects after a successful Bid BFF hosted-login callback. */
export function runHostedPostLoginEffects(input: {
  entryIntent: string | null;
  analyticsEnabled: boolean;
  marketingEnabled: boolean;
  broadcastOnly?: boolean;
  analyticsOnly?: boolean;
}): void {
  if (input.analyticsOnly) {
    if (input.analyticsEnabled) {
      if (input.entryIntent === "silent") {
        trackSilentSignInResult({ strategy: "redirect", outcome: "signed_in" });
      } else {
        trackLogin();
      }
      if (input.entryIntent === "sell" && input.marketingEnabled) {
        trackSellAuthHandoff();
      }
    }
    return;
  }
  if (!input.broadcastOnly && input.analyticsEnabled) {
    trackLogin();
    if (input.entryIntent === "sell" && input.marketingEnabled) {
      trackSellAuthHandoff();
    }
  }
  clearClientActingLegalEntityId();
  postAuthBroadcast({ type: "signed-in" });
}
