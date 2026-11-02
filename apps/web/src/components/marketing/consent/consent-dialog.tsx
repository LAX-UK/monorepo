"use client";

import { ConsentCategoryRow } from "@/components/marketing/consent/consent-category-row";
import {
  CONSENT_CATEGORY_ANALYTICS,
  CONSENT_CATEGORY_MARKETING,
  isMarketingOffered,
} from "@/lib/analytics/consent/categories";
import { useConsent } from "@/lib/analytics/consent/context";
import { Button, Dialog, Switch, TextLink } from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useState } from "react";

const ANALYTICS_ID = `consent-${CONSENT_CATEGORY_ANALYTICS}`;
const MARKETING_ID = `consent-${CONSENT_CATEGORY_MARKETING}`;

/** Cookie settings, opened from the banner's "Settings" and from "Cookie settings" in the footer. */
export function ConsentPreferencesDialog() {
  const { preferencesOpen, closePreferences, snapshot, saveCustom, rejectAll, acceptAll } =
    useConsent();
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const marketingOffered = isMarketingOffered();

  useEffect(() => {
    if (!preferencesOpen) return;
    setAnalytics(snapshot?.analytics ?? false);
    setMarketing(snapshot?.marketing ?? false);
  }, [preferencesOpen, snapshot]);

  return (
    <Dialog
      open={preferencesOpen}
      onOpenChange={(open) => {
        if (!open) closePreferences();
      }}
      title="Cookie settings"
      description="Choose which optional cookies we may use. You can change this at any time from Cookie preferences in the footer."
      footer={
        <>
          <Button
            type="button"
            variant="primary"
            className="max-md:order-first md:order-last"
            onClick={() => void saveCustom({ analytics, marketing })}
          >
            Save choices
          </Button>
          <div className="flex gap-2 max-md:order-last md:mr-auto [&>*]:max-md:flex-1">
            <Button type="button" variant="secondary" onClick={() => void rejectAll()}>
              Reject all
            </Button>
            <Button type="button" variant="secondary" onClick={() => void acceptAll()}>
              Accept all
            </Button>
          </div>
        </>
      }
    >
      <ConsentCategoryRow
        id="consent-essential"
        title="Essential"
        description="Keep you signed in, remember this choice and keep bidding secure. The site can't work without them."
        control={
          <span
            id="consent-essential"
            className="inline-flex h-6 items-center rounded-lax-badge bg-lax-sunken px-2 text-lax-12 font-medium text-lax-muted"
          >
            Always on
          </span>
        }
      />
      <ConsentCategoryRow
        id={ANALYTICS_ID}
        title="Analytics"
        description="Count visits and see which pages help, so we can improve the site. Google Analytics; cookies last up to 13 months."
        detail={
          <TextLink
            href="/cookies"
            Link={Link}
            className="inline-flex min-h-6 w-fit items-center text-lax-13"
          >
            See the cookies
          </TextLink>
        }
        control={
          <Switch
            id={ANALYTICS_ID}
            checked={analytics}
            onCheckedChange={setAnalytics}
            aria-describedby={`${ANALYTICS_ID}-desc`}
          />
        }
      />
      {marketingOffered ? (
        <ConsentCategoryRow
          id={MARKETING_ID}
          title="Marketing"
          description="Measure our adverts on other sites."
          control={
            <Switch
              id={MARKETING_ID}
              checked={marketing}
              onCheckedChange={setMarketing}
              aria-describedby={`${MARKETING_ID}-desc`}
            />
          }
        />
      ) : null}
    </Dialog>
  );
}
