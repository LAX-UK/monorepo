"use client";

import { Countdown, StickyBidBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  end: Date;
  saleTitle: string;
  /** When false, hides the register CTA (e.g. signed-in users). */
  showRegisterCta?: boolean;
};

export function SaleMobileSummaryBar({ end, saleTitle, showRegisterCta = true }: Props) {
  return (
    <StickyBidBar className="lg:hidden" innerClassName="max-w-screen-2xl">
      <div className="min-w-0">
        <p className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
          Sale closes · <span className="sr-only">{saleTitle}</span>
        </p>
        <Countdown
          end={end}
          announce
          className="font-headline text-sm text-on-surface tabular-nums md:text-base"
        />
      </div>
      {showRegisterCta ? (
        <Button variant="cta" className="h-10 shrink-0 px-4 text-xs" asChild>
          <Link href="/register">Register to bid</Link>
        </Button>
      ) : null}
    </StickyBidBar>
  );
}
