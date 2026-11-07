"use client";

import { announceAccountSwitch } from "@/lib/legal-entity/account-switch-channel";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { leaveAccountNotice } from "@/lib/navigation/account-notice-cookie.client";
import { pageAfterSwitch } from "@/lib/navigation/account-page-map";
import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { switchAccount } from "@/lib/navigation/switch-account";
import { notify } from "@/lib/ui/notify";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";

/**
 * What switching needs to know about an account: which one, and whether it is already in use.
 * With its kind, the page after the switch follows the page map; without, it is Home.
 */
export type SwitchTarget = Pick<AccountOption, "id" | "current"> &
  Partial<Pick<AccountOption, "kind">>;

/** Why a switch did not happen, in words the person can read. */
export type SwitchFailure = { title: string; description: string };

/**
 * Where a failure is told: `toast` for a control with no room for it (it offers "Try again"),
 * `inline` for a list that shows it under its rows. A toast cannot be reached from inside a
 * dialog, so a sheet reports inline.
 */
type FailureReporting = "toast" | "inline";

/**
 * Switches the account Bid is used as. The page after the switch is `destination` when given,
 * otherwise the page the person is on when it exists in the new account too, else that account's
 * first page (see `account-page-map.ts`). It is loaded afresh so nothing of the previous account
 * is left on screen, and the new page greets the person once ("Now acting as …").
 * Other open tabs are told, so a bid panel there refreshes who it bids as before the next bid.
 *
 * This is the one way to switch from inside Bid: the client router never visits the switch or
 * restore hops, because it cannot carry the cookie they set through to the layout it keeps.
 */
export function useAccountSwitch(
  destination?: string,
  reporting: FailureReporting = "toast",
): {
  pendingId: string | null;
  failure: SwitchFailure | null;
  choose: (target: SwitchTarget) => Promise<void>;
  /** Tries the last choice again after a failure. */
  retry: () => Promise<void>;
} {
  const pathname = usePathname();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<SwitchFailure | null>(null);
  const lastChoice = useRef<SwitchTarget | null>(null);

  const choose: (target: SwitchTarget) => Promise<void> = useCallback(
    async (option: SwitchTarget) => {
      if (option.current) return;
      lastChoice.current = option;
      setFailure(null);
      setPendingId(option.id);
      const outcome = await switchAccount(option.id, switchActingLegalEntity);
      if (outcome.kind === "refused") {
        setPendingId(null);
        const refusal = { title: outcome.title, description: outcome.description };
        if (reporting === "inline") {
          setFailure(refusal);
        } else {
          notify.error(refusal.title, {
            description: refusal.description,
            action: { label: "Try again", onClick: () => void choose(option) },
          });
        }
        return;
      }
      announceAccountSwitch(option.id);
      // Only the id travels: the next page greets from the server's own account list.
      leaveAccountNotice({ kind: "chose", accountId: option.id });
      // A full page load, on purpose. Switching account changes who every request is for, so
      // nothing the browser holds for the previous account may survive: not the router's cached
      // pages (same address, different cookie), not a query cache, not component state. A load
      // drops all of them at once, where a push or refresh drops only what the router knows of.
      window.location.assign(
        destination ??
          (option.kind
            ? // A public page keeps its query, which the router's pathname leaves out.
              pageAfterSwitch(`${pathname ?? ""}${window.location.search}`, option.kind)
            : CLIENT_ROUTES.home),
      );
    },
    [destination, pathname, reporting],
  );

  const retry = useCallback(async () => {
    if (lastChoice.current) await choose(lastChoice.current);
  }, [choose]);

  return { pendingId, failure, choose, retry };
}
