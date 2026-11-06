"use client";

import { announceAccountSwitch } from "@/lib/legal-entity/account-switch-channel";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { switchAccount } from "@/lib/navigation/switch-account";
import { notify } from "@/lib/ui/notify";
import { useCallback, useState } from "react";

/** What switching needs to know about an account: which one, and whether it is already in use. */
export type SwitchTarget = Pick<AccountOption, "id" | "current">;

/**
 * Switches the account Bid is used as. A new account has a different set of pages, so it opens
 * on that account's Home unless a `destination` is given, loading it afresh so nothing of the
 * previous account is left on screen. Other open tabs are told, so a bid panel there refreshes
 * who it bids as before the next bid.
 *
 * This is the one way to switch from inside Bid: the client router never visits the switch or
 * restore hops, because it cannot carry the cookie they set through to the layout it keeps.
 */
export function useAccountSwitch(destination: string = CLIENT_ROUTES.home): {
  pendingId: string | null;
  choose: (target: SwitchTarget) => Promise<void>;
} {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const choose = useCallback(
    async (option: SwitchTarget) => {
      if (option.current) return;
      setPendingId(option.id);
      const outcome = await switchAccount(option.id, switchActingLegalEntity);
      if (outcome.kind === "refused") {
        setPendingId(null);
        notify.error(outcome.title, { description: outcome.description });
        return;
      }
      announceAccountSwitch(option.id);
      // A full page load, on purpose. Switching account changes who every request is for, so
      // nothing the browser holds for the previous account may survive: not the router's cached
      // pages (same address, different cookie), not a query cache, not component state. A load
      // drops all of them at once, where a push or refresh drops only what the router knows of.
      window.location.assign(destination);
    },
    [destination],
  );

  return { pendingId, choose };
}
