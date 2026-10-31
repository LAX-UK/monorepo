"use client";

import { switchAccountHref } from "@/lib/navigation/account-link";
import {
  ACCOUNT_NOTICE_COOKIE,
  type NotificationSwitchToastView,
} from "@/lib/navigation/account-notice";
import { ButtonLink } from "@auction/ui/lax";
import { Button } from "@auction/ui/lax";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountTile } from "./account-tile";

/** Long enough to read and reach "Switch back"; it stays while hovered or focused. */
const SHOWN_MS = 12_000;

/**
 * "Now acting as Cedar & Stone Fine Art": opening a notification for another account switched to
 * it. The toast names the account and offers "Switch back", which opens the same page in the
 * account the notification was opened from. It clears its cookie at once, so it never repeats.
 */
export function NotificationSwitchToast({ account, fromAccountId }: NotificationSwitchToastView) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [open, setOpen] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    document.cookie = `${ACCOUNT_NOTICE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }, []);
  useEffect(() => {
    if (!open || held) return;
    const timer = window.setTimeout(() => setOpen(false), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [open, held]);

  if (!open) return null;
  const here = `${pathname}${search ? `?${search}` : ""}`;
  return (
    <section
      aria-label="Account changed"
      aria-live="polite"
      data-testid="notification-switch-toast"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-3 rounded-lax-control border border-lax-line bg-lax-raised py-3 pr-3 pl-4 shadow-lax-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[440px] lg:bottom-6"
    >
      <AccountTile account={account} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lax-14 font-medium text-lax-fg">Now acting as {account.name}</p>
        <p className="text-lax-13 text-lax-muted">You opened a notification for that account.</p>
      </div>
      <ButtonLink
        href={switchAccountHref(fromAccountId, here)}
        Link={Link}
        size="sm"
        className="shrink-0"
      >
        Switch back
      </ButtonLink>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        className="-mr-1 shrink-0"
        onClick={() => setOpen(false)}
      >
        <X aria-hidden />
      </Button>
    </section>
  );
}
