"use client";

import { useIsLg } from "@/hooks/use-is-lg";
import { useConsent } from "@/lib/analytics/consent/context";
import { dismissActingContextTooltip } from "@/lib/legal-entity/acting-context.actions";
import { useSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { Button } from "@auction/ui/components/button";
import { Popover, PopoverAnchor, PopoverContent } from "@auction/ui/components/popover";
import { type ReactNode, useId, useState, useTransition } from "react";

type Props = {
  /** Initial visibility — driven by `user.hasSeenActingContextTooltip` SSR. */
  initiallyVisible: boolean;
  /** The account switcher the hint points at. */
  children: ReactNode;
};

/**
 * The one-time "Switch between your accounts" hint under the account switcher, the first time a
 * person lands in the workspace with more than one account. It renders in a portal anchored to
 * the switcher, so the sidebar never clips it, and only where the sidebar shows (on phones the
 * switcher heads the menu sheet instead). Any interaction dismisses it, and the dismissal is kept.
 */
export function ActingAsTooltip({ initiallyVisible, children }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);
  const [pending, startTransition] = useTransition();
  const { showBanner: cookieBannerShowing } = useConsent();
  const signInNoticeActive = useSignInNoticeActive();
  const sidebarShown = useIsLg();
  const titleId = useId();

  // One overlay at a time: the sign-in notice, then the cookie banner, then this hint.
  const open = visible && sidebarShown && !signInNoticeActive && !cookieBannerShowing;

  function handleDismiss() {
    setVisible(false);
    startTransition(async () => {
      await dismissActingContextTooltip();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
      }}
    >
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        aria-labelledby={titleId}
        // A hint shown on arrival never takes focus away from the page.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-72 rounded-lg border-shell-stroke bg-surface-container-lowest p-3 text-on-surface shadow-lg"
        data-testid="account-switcher-hint"
      >
        <p id={titleId} className="font-body text-sm font-medium">
          Switch between your accounts
        </p>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          Use this menu to move between your personal account and your organisations when you bid,
          consign or manage payouts.
        </p>
        <div className="mt-3 flex justify-end">
          <Button type="button" onClick={handleDismiss} disabled={pending}>
            Got it
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
