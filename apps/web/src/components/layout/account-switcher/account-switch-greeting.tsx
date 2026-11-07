"use client";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import { useAppSession } from "@/lib/auth/use-app-session";
import { getClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import {
  type AccountNotice,
  accountNoticeDetail,
  accountNoticeMessage,
  noticeBelongsToAccount,
} from "@/lib/navigation/account-notice";
import {
  clearAccountNotice,
  readAccountNotice,
} from "@/lib/navigation/account-notice-cookie.client";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";
import { focusPageHeadingWhenSettled } from "@/lib/ui/focus-page-heading";
import { useEffect, useState } from "react";
import { AccountToast } from "./account-toast";

/** How long "Now acting as …" stays before it goes by itself. */
export const GREETING_SHOWN_MS = 6000;

type Chosen = Extract<AccountNotice, { kind: "chose" }>;

/**
 * Greets the person once after they chose an account in the switcher: "Now acting as Northbank
 * Gallery" or "Now using your personal account". It lives at the root, so it works on every page
 * the switch can land on, public ones included. The cookie carries only the account's id; the
 * name and kind come from the server's list of the person's accounts, so a cookie cannot put
 * words on the page. It speaks only for the account in use: an id that is not in that list, or is
 * not the current one (a stale cookie, a second tab), is cleared and says nothing. Once the
 * message is announced, focus moves to the page's heading.
 */
export function AccountSwitchGreeting() {
  const { user } = useAppSession();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const context = useAccountMenuContext(user?.id ?? "", user !== null && usesBidAsClient(user));

  // Read the cookie once, as soon as the page is up, and clear it whatever comes next.
  useEffect(() => {
    const notice = readAccountNotice();
    if (notice?.kind !== "chose") return;
    clearAccountNotice();
    setChosen(notice);
  }, []);

  const accounts = context?.accounts;
  if (!chosen || !accounts) return null;
  const accountOf = (id: string) => accounts.find((account) => account.id === id) ?? null;
  const current = accounts.find((account) => account.current);
  const account = accountOf(chosen.accountId);
  if (!(current && account) || !noticeBelongsToAccount(chosen, current.id)) return null;
  // The browser's own account choice must agree, so a second tab's switch is not greeted here.
  if (getClientActingLegalEntityId() !== chosen.accountId) return null;
  return (
    <AccountToast
      account={account}
      title={accountNoticeMessage(chosen, accountOf) ?? ""}
      detail={accountNoticeDetail(chosen, accountOf) ?? undefined}
      autoDismissMs={GREETING_SHOWN_MS}
      testId="account-switch-greeting"
      onAnnounced={focusPageHeadingWhenSettled}
    />
  );
}
