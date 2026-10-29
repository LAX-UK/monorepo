"use client";

import { announceAccountSwitch } from "@/lib/legal-entity/account-switch-channel";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { switchAccount } from "@/lib/navigation/switch-account";
import { notify } from "@/lib/ui/notify";
import { useCallback, useState } from "react";

/**
 * Switches the account Bid is used as. A new account has a different set of pages, so it opens
 * on that account's Home unless a `destination` is given, loading it afresh so nothing of the
 * previous account is left on screen. Other open tabs are told, so a bid panel there refreshes
 * who it bids as before the next bid.
 */
export function useAccountSwitch(destination: string = CLIENT_ROUTES.home): {
  pendingId: string | null;
  choose: (option: AccountOption) => Promise<void>;
} {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const choose = useCallback(
    async (option: AccountOption) => {
      if (option.current) return;
      setPendingId(option.id);
      const outcome = await switchAccount(option.id, switchActingLegalEntity);
      if (outcome.kind === "refused") {
        setPendingId(null);
        notify.error(outcome.title, { description: outcome.description });
        return;
      }
      announceAccountSwitch(option.id);
      // A full navigation, not a router push or refresh: the router keeps pages it fetched for the
      // previous account (the address is the same, only the cookie differs), and after a switch it
      // could show that account's page until the next reload.
      window.location.assign(destination);
    },
    [destination],
  );

  return { pendingId, choose };
}
