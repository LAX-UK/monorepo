"use client";

import { onAccountSwitch } from "@/lib/legal-entity/account-switch-channel";
import { getClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Whether the browser now uses another account than the one this page was rendered for. */
export function accountChangedElsewhere(
  renderedAccountId: string | null,
  browserAccountId: string | null | undefined,
): boolean {
  return Boolean(renderedAccountId && browserAccountId && browserAccountId !== renderedAccountId);
}

/**
 * Keeps an open bid panel's "Bidding as" line true after the account is switched in another
 * tab: the page re-renders for the new account as soon as the switch is announced, and again
 * whenever the tab comes back into view (for browsers without the announcement channel), so the
 * next bid is never placed for an account the panel does not name.
 */
export function useBiddingAccountFreshness(renderedAccountId: string | null): void {
  const router = useRouter();

  useEffect(() => {
    const refreshIfChanged = (browserAccountId: string | null | undefined) => {
      if (accountChangedElsewhere(renderedAccountId, browserAccountId)) router.refresh();
    };
    const unsubscribe = onAccountSwitch(refreshIfChanged);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshIfChanged(getClientActingLegalEntityId());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [renderedAccountId, router]);
}
