import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { UpcomingAuctionVM } from "@/components/sections/home/home-view-models";
import { RevealInView } from "@/components/ui/reveal";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { BodyText, DisplayHeading, SectionHeader } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  auction: UpcomingAuctionVM;
  currentUserId?: string | null;
};

export function LaxUpcomingAuctions({ auction, currentUserId = null }: Props) {
  return (
    <section className="w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-20 md:px-8">
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
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-8">
          <div className="group flex min-w-0 flex-[853] flex-col gap-6">
            <Link href={auction.href} className="block">
              <div className="relative aspect-[853/500] w-full overflow-hidden bg-brand-800 dark:bg-surface-container-high">
                {auction.coverImageUrl ? (
                  <RevealInView
                    className="absolute inset-0 overflow-hidden"
                    innerClassName="absolute inset-0"
                  >
                    <Image
                      src={auction.coverImageUrl}
                      alt={auction.coverImageAlt}
                      fill
                      placeholder="blur"
                      blurDataURL={TINY_IMAGE_BLUR}
                      className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                      sizes="(max-width: 1024px) 100vw, 853px"
                    />
                  </RevealInView>
                ) : null}
              </div>
              <div className="mt-6 flex flex-col gap-3">
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
          </div>
          <div className="flex w-full min-w-0 flex-[507] flex-col gap-8">
            <DisplayHeading
              as="h3"
              className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface"
            >
              Featured Lots
            </DisplayHeading>
            <div className="flex flex-col gap-6">
              {auction.featuredLots.map((lot) => (
                <div key={lot.id} className="flex flex-row gap-4">
                  <Link
                    href={lot.href}
                    className="relative block h-[210px] w-[min(45%,181.5px)] shrink-0 overflow-hidden bg-brand-800 dark:bg-surface-container-high"
                  >
                    {lot.imageUrl ? (
                      <RevealInView
                        className="absolute inset-0 overflow-hidden"
                        innerClassName="absolute inset-0"
                      >
                        <Image
                          src={lot.imageUrl}
                          alt={lot.imageAlt}
                          fill
                          placeholder="blur"
                          blurDataURL={TINY_IMAGE_BLUR}
                          className="object-cover"
                          sizes="182px"
                        />
                      </RevealInView>
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-start gap-3 py-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={lot.href}
                          className="font-headline text-xl font-semibold leading-6 text-brand-900 hover:underline dark:text-on-surface"
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
