"use client";

import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { Button } from "@auction/ui/components/button";

/** Closing sell CTA band for the legal column on `/sell`. */
export function SellPageClosingPromo() {
  return (
    <MarketingPromoCta
      className="mt-10"
      title="Ready to proceed?"
      description="Create an account and start your submission — takes about 3 minutes."
      actions={
        <Button variant="cta" asChild>
          <SellCtaLink href={sellIntakeHref()} source="sell_page">
            Start your submission
          </SellCtaLink>
        </Button>
      }
    />
  );
}
