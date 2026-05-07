import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { UpcomingAuctionVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { BodyText, DisplayHeading, SectionHeader } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ArrowRight, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  auction: UpcomingAuctionVM | null;
  currentUserId?: string | null;
};

export function LaxUpcomingAuctions({ auction, currentUserId = null }: Props) {
  if (!auction) {
    return (
      <section className="mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pb-0 pt-20 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
          <SectionHeader
            heading={
              <DisplayHeading
                as="h2"
                className="text-[40px] font-semibold leading-[60px] text-brand-900 dark:text-on-surface"
              >
                Upcoming Auctions
              </DisplayHeading>
            }
            action={
              <Button variant="chevron" asChild>
                <Link href="/sales" className="inline-flex items-center gap-2 py-[18px]">
                  View all
                  <span className="sr-only"> auctions and sales</span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </Button>
            }
          />
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

  return (
    <section className="mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pb-0 pt-20 md:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <SectionHeader
          heading={
            <DisplayHeading
              as="h2"
              className="text-[40px] font-semibold leading-[60px] text-brand-900 dark:text-on-surface"
            >
              Upcoming Auctions
            </DisplayHeading>
          }
          action={
            <Button variant="chevron" asChild>
              <Link href="/sales" className="inline-flex items-center gap-2 py-[18px]">
                View all
                <span className="sr-only"> auctions and sales</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </Button>
          }
        />
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="group flex min-w-0 flex-[853] flex-col gap-5">
            <Link href={auction.href} className="block">
              <div className="relative aspect-[853/500] w-full overflow-hidden bg-brand-800 dark:bg-surface-container-high">
                <RevealInView
                  className="absolute inset-0 overflow-hidden"
                  innerClassName="absolute inset-0"
                >
                  <MediaImage
                    src={auction.coverImageUrl}
                    alt={auction.coverImageAlt}
                    label="Auction cover"
                    tone="dark"
                    imgClassName="transition-transform duration-700 motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                    sizes="(max-width: 1024px) 100vw, 853px"
                  />
                </RevealInView>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <BodyText className="text-base font-normal uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
                  {auction.dateLabel}
                </BodyText>
                <DisplayHeading
                  as="h3"
                  className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface"
                >
                  {auction.title}
                </DisplayHeading>
              </div>
            </Link>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="mt-2 w-fit rounded-sm border-brand-900/40 px-4 py-2 font-label text-xs font-semibold uppercase tracking-[0.08em] text-brand-900 hover:bg-brand-900/5 dark:border-on-surface/40 dark:text-on-surface"
            >
              <Link href={auction.href} className="inline-flex items-center gap-2">
                View catalogue
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="flex w-full min-w-0 flex-[507] flex-col gap-8">
            <DisplayHeading
              as="h3"
              className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface"
            >
              Featured Lots
            </DisplayHeading>
            <div className="flex flex-col gap-8">
              {auction.featuredLots.map((lot) => (
                <div key={lot.id} className="group flex flex-row items-start gap-4">
                  <Link
                    href={lot.href}
                    className="relative block h-[148px] w-[120px] shrink-0 overflow-hidden bg-surface-container-high dark:bg-surface-container-high"
                  >
                    <RevealInView
                      className="absolute inset-0 overflow-hidden"
                      innerClassName="absolute inset-0"
                    >
                      <MediaImage
                        src={lot.imageUrl}
                        alt={lot.imageAlt}
                        label="Lot artwork"
                        imgClassName="transition-transform duration-700 motion-safe:group-hover:scale-105"
                        sizes="182px"
                      />
                    </RevealInView>
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-start gap-2 py-1">
                    <span className="font-label text-[10px] font-bold uppercase tracking-[0.1em] text-lot-orange">
                      Lot
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={lot.href}
                          className="font-headline text-base font-semibold leading-5 text-brand-900 underline-offset-4 group-hover:underline dark:text-on-surface"
                        >
                          {lot.title}
                        </Link>
                        <OwnerBadge
                          owned={Boolean(currentUserId && lot.sellerId === currentUserId)}
                        />
                      </div>
                      <BodyText className="text-sm font-light leading-4 text-brand-500 dark:text-on-surface-variant">
                        {lot.artistName}
                      </BodyText>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-body text-xs font-normal leading-4 text-brand-400 dark:text-on-surface-variant">
                        {lot.priceLabel}
                      </span>
                      <span className="font-body text-sm font-medium leading-6 text-brand-400 dark:text-on-surface-variant">
                        {lot.priceFormatted}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
