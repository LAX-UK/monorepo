"use client";

import { clearAccountNotice } from "@/lib/navigation/account-notice-cookie.client";
import { pageAfterSwitch } from "@/lib/navigation/account-page-map";
import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { Button } from "@auction/ui/lax/button";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AccountToast } from "./account-toast";
import { useAccountSwitch } from "./use-account-switch";

/** Long enough to read and reach the way back; it stays while hovered or focused. */
const SHOWN_MS = 12_000;

export type SwitchBackToastProps = {
  account: Pick<AccountOption, "kind" | "initials">;
  title: string;
  detail?: string | undefined;
  /** The button's words: "Switch back", "Back to Personal". */
  backLabel: string;
  /** The kind of account the way back goes to, which decides the page it opens. */
  fromKind: AccountOption["kind"];
  fromAccountId: string;
  testId: string;
};

/**
 * A toast for an account Bid opened because of a link: it names the account and offers the way
 * back, which opens the page the other account has for this one (its list, or its Home from a
 * record, which only the account just left can open). It clears its cookie at once, so it never
 * repeats.
 */
export function SwitchBackToast({
  account,
  title,
  detail,
  backLabel,
  fromKind,
  fromAccountId,
  testId,
}: SwitchBackToastProps) {
  const pathname = usePathname();
  const { pendingId, choose } = useAccountSwitch(pageAfterSwitch(pathname, fromKind));

  useEffect(() => clearAccountNotice(), []);

  return (
    <AccountToast
      account={account}
      title={title}
      detail={detail}
      autoDismissMs={SHOWN_MS}
      testId={testId}
      action={
        <Button
          size="sm"
          className="shrink-0 max-sm:min-h-11"
          aria-busy={pendingId !== null || undefined}
          disabled={pendingId !== null}
          onClick={() => void choose({ id: fromAccountId, current: false, kind: fromKind })}
        >
          {backLabel}
        </Button>
      }
    />
  );
}
