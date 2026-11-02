"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { useSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { cn } from "@auction/ui";
import { Button, TextLink, laxDensityAttributes } from "@auction/ui/lax";
import Link from "next/link";
import { type FocusEvent, useCallback, useEffect, useRef } from "react";

/**
 * Not modal, so focus is never trapped. When a choice removes the banner, focus goes back to where
 * the person was before they reached it, instead of falling to the top of the page.
 */
function useRestoreFocusOnDismiss() {
  const origin = useRef<HTMLElement | null>(null);
  useEffect(
    () => () => {
      const target = origin.current;
      queueMicrotask(() => {
        const active = document.activeElement;
        if (target?.isConnected && (!active || active === document.body)) {
          target.focus({ preventScroll: true });
        }
      });
    },
    [],
  );
  return useCallback((event: FocusEvent<HTMLElement>) => {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) origin.current = from;
  }, []);
}

/**
 * The first-visit cookie banner: three equal choices, a plain sentence and the policy link. A slim
 * bar along the bottom edge from 768px, and a card above the bottom edge on a phone. It renders
 * inside the dock, which owns the position and the reserved space.
 */
export function ConsentBar() {
  const { showBanner } = useConsent();
  const signInNoticeActive = useSignInNoticeActive();
  if (!showBanner || signInNoticeActive) return null;
  return <CookieBanner />;
}

function CookieBanner() {
  const { acceptAll, rejectAll, openPreferences } = useConsent();
  const rememberOrigin = useRestoreFocusOnDismiss();
  return (
    <section
      aria-label="Cookies"
      data-cookie-banner=""
      onFocus={rememberOrigin}
      {...laxDensityAttributes("client")}
      className={cn(
        "pointer-events-auto mx-2 mb-2 rounded-lax-card border border-lax-line bg-lax-raised p-4 font-lax text-lax-fg shadow-lax-md",
        "md:mx-0 md:mb-0 md:rounded-none md:border-x-0 md:border-b-0 md:p-0 md:shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)]",
      )}
    >
      <div className="md:mx-auto md:flex md:max-w-[1440px] md:items-center md:gap-8 md:px-10 md:py-3.5">
        <p className="mb-3 text-lax-13 leading-5 text-lax-muted md:mb-0 md:max-w-[760px] md:flex-1">
          <b className="font-semibold text-lax-fg">Cookies on LAX Bid.</b> We use essential cookies
          to run the site and keep you signed in. With your permission we'd also use analytics
          cookies to learn how the site is used.{" "}
          <TextLink href="/cookies" Link={Link}>
            Cookie policy
          </TextLink>
        </p>
        <div className="grid grid-cols-3 gap-2 md:flex-none">
          <Button
            type="button"
            variant="secondary"
            className="md:min-w-32 max-md:px-2"
            onClick={() => void acceptAll()}
          >
            Accept all
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="md:min-w-32 max-md:px-2"
            onClick={() => void rejectAll()}
          >
            Reject all
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="md:min-w-32 max-md:px-2"
            onClick={openPreferences}
          >
            Settings
          </Button>
        </div>
      </div>
    </section>
  );
}
