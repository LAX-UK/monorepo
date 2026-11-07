"use client";

import { clearAccountNotice } from "@/lib/navigation/account-notice-cookie.client";
import { focusPageHeading } from "@/lib/ui/focus-page-heading";
import { Button } from "@auction/ui/components/button";
import { ArrowLeftRight, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  message: string;
  /** A second line saying what changed ("Your own bids and purchases."). */
  detail?: string | null;
  /** The person chose this change: focus moves to the page's heading once it has loaded. */
  focusHeading?: boolean;
  /** Goes away by itself after this long; stays until dismissed otherwise. */
  autoDismissMs?: number;
};

/**
 * A one-time line saying the account changed ("Now acting as Northbank Gallery", "Switched to
 * Northbank Gallery to show this."). It is a polite live region, so a screen reader hears it
 * without losing its place. It clears its cookie as soon as it is shown, so it never repeats.
 */
export function AccountNotice({ message, detail, focusHeading = false, autoDismissMs }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    clearAccountNotice();
    if (!focusHeading) return;
    // After the frame, so nothing that settles on load takes focus back.
    const frame = window.requestAnimationFrame(() => focusPageHeading());
    return () => window.cancelAnimationFrame(frame);
  }, [focusHeading]);

  useEffect(() => {
    if (autoDismissMs === undefined) return;
    const timer = window.setTimeout(() => setOpen(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs]);

  if (!open) return null;
  return (
    <output
      aria-live="polite"
      data-testid="account-notice"
      className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low py-2.5 pr-2 pl-4"
    >
      <ArrowLeftRight
        className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1 py-px">
        <p className="font-body text-sm text-on-surface">{message}</p>
        {detail ? (
          <p className="font-body text-xs text-on-surface-variant max-sm:hidden">{detail}</p>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="link"
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="-my-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface sm:size-7"
      >
        <X className="size-4" strokeWidth={1.75} aria-hidden />
      </Button>
    </output>
  );
}
