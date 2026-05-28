import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { HomeSectionToolbar } from "@/components/marketing/home-section-toolbar";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { UpcomingAuctionsMarketingClient } from "./upcoming-auctions-marketing-client";

type Props = {
  tiles: HomeUpcomingAuctionTileVM[];
  layoutView: CatalogLayoutView;
  isAuthenticated: boolean;
};

export function LaxUpcomingAuctionsMarketing({ tiles, layoutView, isAuthenticated }: Props) {
  if (tiles.length === 0) {
    return (
      <section
        aria-labelledby="home-upcoming-auctions-heading"
        className={`${MARKETING_PAGE_SHELL} pb-0 pt-10`}
      >
        <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
          <MarketingSectionHeader
            heading={
              <DisplayHeading
                as="h2"
                id="home-upcoming-auctions-heading"
                size="section"
                className="font-semibold text-on-surface"
              >
                Upcoming Auctions
              </DisplayHeading>
            }
            subtitle="Scheduled and live sales curated by LAX specialists"
            action={
              <Button variant="chevron" asChild>
                <Link href="/sales" className="inline-flex items-center gap-2 py-[18px]">
                  View All
                  <span className="sr-only"> auctions and sales</span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </Button>
            }
          />
          <HomeSectionToolbar
            className="mb-2"
            countLabel="0 auctions"
            trailing={
              <CatalogViewSwitcher
                routeKey="home-upcoming"
                value={layoutView === "list" ? "list" : "grid"}
                supportedModes={["grid", "list"]}
              />
            }
          />
          <MarketingEmptyState
            variant="marketing"
            icon={<Calendar aria-hidden />}
            title="No auctions scheduled"
            description="Our next auction is being prepared. Sign up for our newsletter to be the first to know."
            action={
              <Button variant="outline" asChild>
                <Link href="#newsletter">Get notified</Link>
              </Button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <UpcomingAuctionsMarketingClient
      tiles={tiles}
      layoutView={layoutView}
      isAuthenticated={isAuthenticated}
    />
  );
}
