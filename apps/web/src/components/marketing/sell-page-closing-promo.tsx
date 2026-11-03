"use client";

import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

/** Closing sell CTA band for the legal column on `/sell`. */
export function SellPageClosingPromo() {
  return (
    <MarketingPromoCta
      className="mt-10"
      title="Ready to proceed?"
      description="Create an account and tell us about your work. It takes about 3 minutes."
      actions={
        <>
          <Button variant="primary" asChild>
            <SellCtaLink href={sellIntakeHref()} source="sell_page">
              {SELL_A_WORK_LABEL}
            </SellCtaLink>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/contact">Talk to a specialist</Link>
          </Button>
        </>
      }
    />
  );
}
