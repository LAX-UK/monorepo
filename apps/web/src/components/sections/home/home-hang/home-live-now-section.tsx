"use client";

import { type LiveNowVM, liveTabLabel } from "@/lib/hang/live-now";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { defaultLiveTab } from "@auction/domain";
import { MarketingHang } from "@auction/marketing-ui";
import { TextLink } from "@auction/ui/lax";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { LiveTabs, liveTabId, liveTabPanelId } from "./live-tabs";
import { toHangProps } from "./to-hang-props";
import { useEngagedSales } from "./use-engaged-sales";

/**
 * "Live now": the hang of each live sale, one tab per sale. The server opens the lead sale; a
 * signed-in bidder lands on the sale they are in. Every hang is drawn up front and stacked in one
 * cell, so the section keeps the height of the tallest and nothing moves when a tab changes.
 */
export function HomeLiveNowSection({
  liveNow,
  signedIn,
}: {
  liveNow: LiveNowVM;
  signedIn: boolean;
}) {
  const idBase = useId();
  const saleIds = useMemo(() => liveNow.tabs.map((tab) => tab.saleId), [liveNow.tabs]);
  const engaged = useEngagedSales(saleIds, signedIn);
  const [chosen, setChosen] = useState<string | null>(null);
  const activeId = chosen ?? defaultLiveTab(saleIds, liveNow.defaultSaleId, engaged) ?? "";

  return (
    <section aria-labelledby={`${idBase}-heading`} className="pt-10 sm:pt-14">
      <div className={MARKETING_PAGE_SHELL}>
        <h2
          id={`${idBase}-heading`}
          className="font-headline text-2xl font-medium leading-[30px] tracking-[-0.01em] text-on-surface md:text-[40px] md:leading-[48px]"
        >
          Live now
        </h2>
        <div className="mt-4 flex min-w-0 flex-col gap-1 md:mt-6 md:flex-row md:items-center md:gap-4">
          <LiveTabs
            idBase={idBase}
            label="Live sales"
            tabs={liveNow.tabs.map((tab) => ({ id: tab.saleId, label: liveTabLabel(tab) }))}
            activeId={activeId}
            onSelect={setChosen}
          />
          <TextLink href={liveNow.allLive.href} Link={Link} className="shrink-0 whitespace-nowrap">
            {liveNow.allLive.label}
          </TextLink>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)]">
        {liveNow.tabs.map((tab) => {
          const active = tab.saleId === activeId;
          return (
            <div
              key={tab.saleId}
              role="tabpanel"
              id={liveTabPanelId(idBase, tab.saleId)}
              aria-labelledby={liveTabId(idBase, tab.saleId)}
              inert={!active}
              className={active ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"}
            >
              <MarketingHang
                title={tab.title}
                headingLevel={3}
                headingSize="compact"
                className="pt-6 sm:pt-8"
                {...toHangProps(tab.hang)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
