import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_A_WORK_LABEL, SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";
import { sellContactHref, sellIntakeHref } from "@/lib/marketing/sell-intake";
import { SELL_TALK_LABEL } from "@/lib/marketing/sell-landing";
import { cn } from "@auction/ui";
import { buttonVariants } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  /** Category to choose in the form; the page of a department passes its own. */
  categorySlug?: string;
  /** Kind of enquiry for "Talk to a specialist". */
  contactType?: Parameters<typeof sellContactHref>[0];
  /** Analytics source of the "Sell a work" link. */
  source: string;
  /** A line under the buttons, such as the link to private sales. */
  footnote?: ReactNode;
  className?: string;
};

/** The closing call to action of the selling pages: the form first, a conversation second. */
export function SellClosingCta({ categorySlug, contactType, source, footnote, className }: Props) {
  return (
    <div className={className}>
      <MarketingPromoCta
        as="div"
        title="Ready to sell?"
        description={`Send us a work and a specialist will value it for free. ${SPECIALIST_RESPONSE_PROMISE}`}
        actions={
          <>
            <SellCtaLink
              href={sellIntakeHref(categorySlug ? { categorySlug } : undefined)}
              source={source}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "max-md:w-full")}
            >
              {SELL_A_WORK_LABEL}
            </SellCtaLink>
            <Link
              href={sellContactHref(contactType)}
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "max-md:w-full")}
            >
              {SELL_TALK_LABEL}
            </Link>
          </>
        }
      />
      {footnote ? (
        <p className="mt-6 font-body text-sm text-on-surface-variant">{footnote}</p>
      ) : null}
    </div>
  );
}

/** "Prefer to sell without an auction?" pointer to private sales. */
export function SellPrivateSalesNote() {
  return (
    <>
      Prefer not to sell at auction?{" "}
      <Link href="/sell/private-sales" className={MARKETING_PROSE_LINK}>
        Sell a work privately
      </Link>
      .
    </>
  );
}
