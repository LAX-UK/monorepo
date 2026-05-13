"use client";

import { Button } from "@/components/ui/button";
import { dismissActingContextTooltip } from "@/lib/legal-entity/acting-context.actions";
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

  if (!visible) return null;

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
      <p className="text-sm font-medium">You can act on behalf of others</p>
      <p className="mt-1 text-sm text-on-surface-variant">
        Switch the current legal entity from this menu to bid, consign, or manage payouts on behalf
        of an organisation you belong to.
      </p>
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={handleDismiss} disabled={pending}>
          Got it
        </Button>
      </div>
    </output>
  );
}
