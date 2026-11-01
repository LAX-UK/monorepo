"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";

type Props = {
  className?: string;
};

/** Footer / legal area trigger to reopen the cookie preferences dialog. */
export function CookiePreferencesLink({ className }: Props) {
  const { openPreferences } = useConsent();
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "inline-flex h-auto w-fit px-0 in-data-[lax-density=client]:px-0 items-center justify-start text-left font-footer-links text-on-surface/90 transition-colors hover:bg-transparent hover:text-link",
        FOCUS_RING,
        className,
      )}
      onClick={openPreferences}
    >
      Cookie preferences
    </Button>
  );
}
