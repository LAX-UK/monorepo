"use client";

import { Countdown, StickyBidBar } from "@auction/ui";

type Props = {
  end: Date;
  saleTitle: string;
};

export function SaleMobileSummaryBar({ end, saleTitle }: Props) {
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
    </StickyBidBar>
  );
}
