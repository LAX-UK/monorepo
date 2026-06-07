import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  className?: string;
  /** Override default register href. */
  registerHref?: string;
  loginHref?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
};

/** Standard unauthenticated “Ready to bid?” promo — use instead of `SectionCta` on marketing surfaces. */
export function MarketingBidPromoCta({
  className,
  registerHref = "/register",
  loginHref = "/login",
  primaryAction,
  secondaryAction,
}: Props) {
  return (
    <MarketingPromoCta
      {...(className ? { className } : {})}
      title="Ready to bid?"
      description="Create a free account to place bids, track lots, and receive saleroom updates."
      actions={
        <>
          {primaryAction ?? (
            <Button variant="cta" asChild>
              <Link href={registerHref}>Register to bid</Link>
            </Button>
          )}
          {secondaryAction ?? (
            <Button variant="outline" asChild>
              <Link href={loginHref}>Sign in</Link>
            </Button>
          )}
        </>
      }
    />
  );
}
