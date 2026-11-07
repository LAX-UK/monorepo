"use client";

import { Button } from "@auction/ui/lax";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { AccountTile } from "./account-tile";

/** How long after the message goes in before the callback runs. */
export const FOCUS_AFTER_ANNOUNCE_MS = 200;

type Props = {
  account: { kind: "personal" | "organisation"; initials: string };
  title: string;
  detail?: string | undefined;
  /** A button after the text ("Switch back"). */
  action?: ReactNode;
  /** Goes away by itself after this long; it stays while hovered or focused. */
  autoDismissMs: number;
  testId: string;
  /** Called a moment after the message is in the live region, for example to move focus. */
  onAnnounced?: () => void;
};

/**
 * The floating toast for an account change: a polite live region, dismissible, gone after a few
 * seconds. The region is on the page empty and the message is put in it on the next frame, which
 * is what makes a screen reader read it; a region that arrives already full is often missed.
 */
export function AccountToast({
  account,
  title,
  detail,
  action,
  autoDismissMs,
  testId,
  onAnnounced,
}: Props) {
  const [announced, setAnnounced] = useState(false);
  const [open, setOpen] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnnounced(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Later than the message, so a screen reader reads it before focus moves to the heading.
  useEffect(() => {
    if (!announced || !onAnnounced) return;
    const timer = window.setTimeout(onAnnounced, FOCUS_AFTER_ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [announced, onAnnounced]);

  useEffect(() => {
    if (!announced || !open || held) return;
    const timer = window.setTimeout(() => setOpen(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [announced, open, held, autoDismissMs]);

  return (
    <output
      aria-live="polite"
      data-testid={testId}
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[440px] lg:bottom-6"
    >
      {announced && open ? (
        <section
          aria-label="Account changed"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          className="pointer-events-auto flex items-center gap-3 rounded-lax-control border border-lax-line bg-lax-raised py-3 pr-3 pl-4 shadow-lax-md"
        >
          <AccountTile account={account} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-lax-14 font-medium text-lax-fg">{title}</p>
            {detail ? <p className="text-lax-13 text-lax-muted max-sm:hidden">{detail}</p> : null}
          </div>
          {action}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            className="-mr-1 shrink-0 max-sm:size-11"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden />
          </Button>
        </section>
      ) : null}
    </output>
  );
}
