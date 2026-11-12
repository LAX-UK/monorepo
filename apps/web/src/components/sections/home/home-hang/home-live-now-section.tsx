"use client";

import { type LiveNowVM, liveTabName } from "@/lib/hang/live-now";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { defaultLiveTab } from "@auction/domain";
import { MarketingHang } from "@auction/marketing-ui/hang/marketing-hang";
import { Tabs } from "@auction/ui/lax/tab-panels";
import { TextLink } from "@auction/ui/lax/text-link";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toHangProps } from "./to-hang-props";
import { useEngagedSales } from "./use-engaged-sales";

/**
 * "Live now": the hang of each live sale, one tab per sale. The server opens the lead sale; a
 * signed-in bidder lands on the sale they are in. The active tab names the sale, so the hang
 * under it keeps only its meta line, its link and its arrows.
 */
export function HomeLiveNowSection({
  liveNow,
  signedIn,
}: {
  liveNow: LiveNowVM;
  signedIn: boolean;
}) {
  const headingId = useId();
  const saleIds = useMemo(() => liveNow.tabs.map((tab) => tab.saleId), [liveNow.tabs]);
  const engaged = useEngagedSales(saleIds, signedIn);
  const [chosen, setChosen] = useState<string | null>(null);
  const activeId = chosen ?? defaultLiveTab(saleIds, liveNow.defaultSaleId, engaged) ?? "";

  return (
    <section aria-labelledby={headingId} className="pt-10 sm:pt-14">
      <div className={MARKETING_PAGE_SHELL}>
        <h2
          id={headingId}
          className="font-headline text-2xl font-medium leading-[30px] tracking-[-0.01em] text-on-surface md:text-[40px] md:leading-[48px]"
        >
          Live now
        </h2>
      </div>
      <Tabs
        className="mt-4 md:mt-6"
        barClassName={MARKETING_PAGE_SHELL}
        label="Live sales"
        value={activeId}
        onValueChange={setChosen}
        trailing={
          <TextLink href={liveNow.allLive.href} Link={Link} className="whitespace-nowrap">
            {liveNow.allLive.label}
          </TextLink>
        }
        items={liveNow.tabs.map((tab) => ({
          id: tab.saleId,
          label: tab.title,
          detail: tab.closes,
          name: liveTabName(tab),
          panel: (
            <MarketingHang
              title={tab.title}
              headingLevel={3}
              hideTitle
              className="pt-4 sm:pt-5"
              {...toHangProps(tab.hang)}
            />
          ),
        }))}
      />
    </section>
  );
}
