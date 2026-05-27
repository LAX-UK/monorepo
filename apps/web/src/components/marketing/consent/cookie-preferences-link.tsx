"use client";

import { useConsent } from "@/lib/analytics/consent/context";
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
        "inline-flex h-auto min-h-0 w-fit justify-start px-0 text-left font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:bg-transparent hover:text-primary",
        className,
      )}
      onClick={openPreferences}
    >
      Cookie preferences
    </Button>
  );
}
