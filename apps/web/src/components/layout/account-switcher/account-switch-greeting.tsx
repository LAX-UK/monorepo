"use client";

import { getClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import {
  type AccountNotice,
  accountNoticeDetail,
  accountNoticeMessage,
} from "@/lib/navigation/account-notice";
import {
  clearAccountNotice,
  readAccountNotice,
} from "@/lib/navigation/account-notice-cookie.client";
import { focusPageHeadingWhenSettled } from "@/lib/ui/focus-page-heading";
import { useEffect, useState } from "react";
import { AccountToast } from "./account-toast";

/** How long "Now acting as …" stays before it goes by itself. */
export const GREETING_SHOWN_MS = 6000;

type Chosen = Extract<AccountNotice, { kind: "chose" }>;

/**
 * Greets the person once after they chose an account in the switcher: "Now acting as Northbank
 * Gallery" or "Now using your personal account". It lives at the root, so it works on every page
 * the switch can land on, public ones included, and reads and clears its cookie whatever the page.
 * Once the message is announced, focus moves to the page's heading.
 *
 * It only speaks for the account in use: a cookie left for another account (a stale one, a second
 * tab) is cleared and says nothing.
 */
export function AccountSwitchGreeting() {
  const [chosen, setChosen] = useState<Chosen | null>(null);

  useEffect(() => {
    const notice = readAccountNotice();
    if (notice?.kind !== "chose") return;
    clearAccountNotice();
    if (notice.accountId === getClientActingLegalEntityId()) setChosen(notice);
  }, []);

  if (!chosen) return null;
  const accountOf = () => ({ kind: chosen.accountKind, name: chosen.accountName });
  return (
    <AccountToast
      account={{ kind: chosen.accountKind, initials: chosen.accountInitials }}
      title={accountNoticeMessage(chosen, accountOf) ?? ""}
      detail={accountNoticeDetail(chosen, accountOf) ?? undefined}
      autoDismissMs={GREETING_SHOWN_MS}
      testId="account-switch-greeting"
      onAnnounced={focusPageHeadingWhenSettled}
    />
  );
}
