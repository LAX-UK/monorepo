"use client";

import {
  ART_COOKIE_SETTINGS_HASH,
  type ArtConsentChoice,
  artConsentCookie,
  buildGtagInitSnippet,
} from "@/lib/analytics/art-consent";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

type ArtAnalyticsConsentProps = {
  measurementId: string;
  initialChoice: ArtConsentChoice | null;
};

function clearAnalyticsCookies() {
  const domains = ["", `; domain=.${window.location.hostname.replace(/^www\./, "")}`];
  for (const name of document.cookie.split(";").map((part) => part.split("=")[0]?.trim())) {
    if (!name?.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }
}

/** Cookie banner plus GA4, which loads only after the visitor accepts analytics cookies. */
export function ArtAnalyticsConsent({ measurementId, initialChoice }: ArtAnalyticsConsentProps) {
  const [choice, setChoice] = useState(initialChoice);
  const [open, setOpen] = useState(initialChoice === null);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash !== ART_COOKIE_SETTINGS_HASH) return;
      setOpen(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const decide = useCallback(
    (next: ArtConsentChoice) => {
      document.cookie = artConsentCookie(next, window.location.protocol === "https:");
      if (next === "denied") {
        (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
        clearAnalyticsCookies();
      }
      setChoice(next);
      setOpen(false);
    },
    [measurementId],
  );

  return (
    <>
      {choice === "granted" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
            strategy="afterInteractive"
          />
          <Script id="art-gtag-init" strategy="afterInteractive">
            {buildGtagInitSnippet(measurementId)}
          </Script>
        </>
      ) : null}
      {open ? (
        <section
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-[var(--art-bottom-nav-height)] z-50 flex justify-center p-4 md:bottom-0"
          data-testid="art-cookie-consent"
        >
          <div className="flex w-full max-w-3xl flex-col gap-4 rounded-lg border border-outline-variant/60 bg-surface p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              We use essential cookies to run this site. With your permission we also use Google
              Analytics to understand how it is used.{" "}
              <Link href="/legal/cookies" className="art-focus-ring rounded-sm text-link underline">
                Cookie policy
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 font-label sm:flex-none"
                onClick={() => decide("denied")}
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 font-label sm:flex-none"
                onClick={() => decide("granted")}
              >
                Accept
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
