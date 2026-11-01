"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { useSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { Card, CardContent } from "@auction/ui";
import { Button, laxDensityAttributes } from "@auction/ui/lax";
import Link from "next/link";

/** Underlined at rest: colour alone does not set a link apart from the paragraph around it. */
const POLICY_LINK = "text-link underline underline-offset-4 hover:decoration-2";

/** First-visit cookie banner: Accept all + Customise (reject via preferences dialog). */
export function ConsentBar() {
  const { showBanner, acceptAll, openPreferences } = useConsent();

  const signInNoticeActive = useSignInNoticeActive();

  if (!showBanner || signInNoticeActive) return null;

  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-site-chrome,50)] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      aria-label="Cookie consent"
      {...laxDensityAttributes("client")}
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
              <Link href="/cookies" className={POLICY_LINK}>
                Cookie policy
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className={POLICY_LINK}>
                Privacy notice
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto sm:min-w-[8.5rem]"
              onClick={openPreferences}
            >
              Customise
            </Button>
            <Button
              variant="primary"
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
