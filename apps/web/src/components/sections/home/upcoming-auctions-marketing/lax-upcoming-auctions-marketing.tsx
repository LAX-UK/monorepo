import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Calendar } from "lucide-react";
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
        className={`${MARKETING_PAGE_SHELL} pb-0 pt-[var(--section-spacing-tight)]`}
      >
        <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-8">
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
            action={<MarketingViewAllLink href="/sales" srSuffix="auctions and sales" />}
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
