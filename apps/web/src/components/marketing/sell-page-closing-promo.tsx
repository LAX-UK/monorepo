"use client";

import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { sellContactHref, sellIntakeHref } from "@/lib/marketing/sell-intake";
import { Button } from "@auction/ui/components/button";

/** Closing sell CTA band for the legal column on `/sell`. */
export function SellPageClosingPromo() {
  return (
    <MarketingPromoCta
      className="mt-10"
      title="Ready to proceed?"
      description="Start a submission or speak to a specialist."
      actions={
        <>
          <Button variant="cta" asChild>
            <SellCtaLink href={sellIntakeHref()} source="sell_page">
              Start submission
            </SellCtaLink>
          </Button>
          <Button variant="outline" asChild>
            <SellCtaLink href={sellContactHref()} source="sell_contact">
              Speak to a specialist
            </SellCtaLink>
          </Button>
        </>
      }
    />
  );
}
