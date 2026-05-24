"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { Button, Card, CardContent } from "@auction/ui";
import Link from "next/link";

/** First-visit cookie banner: equal-prominence Accept / Reject / Customise. */
export function ConsentBar() {
  const { showBanner, acceptAll, rejectAll, openPreferences } = useConsent();

  if (!showBanner) return null;

  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-site-chrome,50)] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      aria-label="Cookie consent"
    >
      <Card className="pointer-events-auto w-full max-w-3xl border border-outline-variant/60 shadow-lg">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="font-headline text-base font-semibold text-on-surface">
              Cookies on LAX.BID
            </p>
            <p className="font-body text-sm leading-relaxed text-on-surface-variant">
              We use strictly necessary cookies to run the site. With your permission we use
              analytics (Google Tag Manager / Google Analytics) to understand how the platform is
              used. Read our{" "}
              <Link href="/cookies" className="text-primary underline-offset-4 hover:underline">
                Cookie policy
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy notice
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto sm:min-w-[8.5rem]"
              onClick={() => void rejectAll()}
            >
              Reject all
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto sm:min-w-[8.5rem]"
              onClick={openPreferences}
            >
              Customise
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto sm:min-w-[8.5rem]"
              onClick={() => void acceptAll()}
            >
              Accept all
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
