"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { dismissActingContextTooltip } from "@/lib/legal-entity/acting-context.actions";
import { useSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { Button } from "@auction/ui/components/button";
import { useState, useTransition } from "react";

type Props = {
  /** Initial visibility — driven by `user.hasSeenActingContextTooltip` SSR. */
  initiallyVisible: boolean;
};

/** Small popover-style hint shown the first time a user lands in the app
 * after gaining access to multiple legal entities. Auto-dismisses on
 * interaction and persists the dismissal to the API.
 */
export function ActingAsTooltip({ initiallyVisible }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);
  const [pending, startTransition] = useTransition();
  const { showBanner: cookieBannerShowing } = useConsent();
  const signInNoticeActive = useSignInNoticeActive();

  // One overlay at a time: the sign-in notice, then the cookie banner, then this hint.
  if (!visible || signInNoticeActive || cookieBannerShowing) return null;

  function handleDismiss() {
    setVisible(false);
    startTransition(async () => {
      await dismissActingContextTooltip();
    });
  }

  return (
    <output
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border bg-surface p-3 shadow-lg"
      aria-live="polite"
    >
      <p className="text-sm font-medium">Switch between your accounts</p>
      <p className="mt-1 text-sm text-on-surface-variant">
        Use this menu to move between your personal account and your organisations when you bid,
        consign or manage payouts.
      </p>
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={handleDismiss} disabled={pending}>
          Got it
        </Button>
      </div>
    </output>
  );
}
