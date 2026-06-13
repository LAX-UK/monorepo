"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

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
        "inline-flex h-auto min-h-11 w-fit items-center justify-start rounded-sm px-0 text-left font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:bg-transparent hover:text-link",
        FOCUS_RING,
        className,
      )}
      onClick={openPreferences}
    >
      Cookie preferences
    </Button>
  );
}
