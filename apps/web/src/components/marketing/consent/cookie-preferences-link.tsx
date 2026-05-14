"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { cn } from "@auction/ui";

type Props = {
  className?: string;
};

/** Footer / legal area trigger to reopen the cookie preferences dialog. */
export function CookiePreferencesLink({ className }: Props) {
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={cn(
        "inline-flex w-fit text-left font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-primary",
        className,
      )}
    >
      Cookie preferences
    </button>
  );
}
