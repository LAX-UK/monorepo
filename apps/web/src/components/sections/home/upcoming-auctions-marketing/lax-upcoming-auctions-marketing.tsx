import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { UpcomingAuctionsMarketingClient } from "./upcoming-auctions-marketing-client";

type Props = {
  tiles: HomeUpcomingAuctionTileVM[];
};

export function LaxUpcomingAuctionsMarketing({ tiles }: Props) {
  if (tiles.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
          <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <DisplayHeading
              as="h2"
              className="text-[40px] font-semibold leading-[60px] text-[#050505] dark:text-on-surface"
            >
              Upcoming Auctions
            </DisplayHeading>
            <Button variant="chevron" asChild>
              <Link href="/sales" className="inline-flex items-center gap-2 py-[18px]">
                View All
                <span className="sr-only"> auctions and sales</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </Button>
          </div>
          <EmptyState
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

  return <UpcomingAuctionsMarketingClient tiles={tiles} />;
}
