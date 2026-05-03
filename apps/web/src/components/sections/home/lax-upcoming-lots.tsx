import { LotCardTimer } from "@/components/lot-timer";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { RevealInView } from "@/components/ui/reveal";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { BodyText, DisplayHeading, SectionHeader } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  items: LotCardVM[];
  saleMetaLine: string;
  currentUserId?: string | null;
};

export function LaxUpcomingLots({ items, saleMetaLine, currentUserId = null }: Props) {
  return (
    <section className="mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pb-0 pt-20 md:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <SectionHeader
          kicker={
            <LiveIndicatorRow
              tone="light"
              progressLabel="Auction in progress"
              saleLine={saleMetaLine}
            />
          }
          heading={
            <DisplayHeading
              as="h2"
              className="text-[40px] font-semibold leading-[60px] text-brand-900 dark:text-on-surface"
            >
              Upcoming Lots
            </DisplayHeading>
          }
          action={
            <Button variant="chevron" asChild>
              <Link href="/search" className="inline-flex items-center gap-2 py-[18px]">
                View all
                <span className="sr-only"> upcoming lots and sales</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </Button>
          }
        />
        {items.length === 0 ? (
          <BodyText className="text-brand-400 dark:text-on-surface-variant">
            No upcoming lots to display.
          </BodyText>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
              <article
                key={item.id}
                className="fade-up flex flex-col"
                style={{ animationDelay: `${Math.min(index * 80, 320)}ms` }}
              >
                <Link
                  href={item.href}
                  className="group flex flex-col gap-4 outline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="relative aspect-[320/340] w-full overflow-hidden bg-surface-container-high dark:bg-surface-container-high">
                    {item.imageUrl ? (
                      <RevealInView
                        className="absolute inset-0 overflow-hidden"
                        innerClassName="absolute inset-0"
                        delayMs={Math.min(index * 70, 280)}
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.imageAlt}
                          fill
                          placeholder="blur"
                          blurDataURL={TINY_IMAGE_BLUR}
                          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      </RevealInView>
                    ) : (
                      <ImagePlaceholder label="Lot artwork" />
                    )}
                    <LotCardTimer
                      status={item.status}
                      startTime={item.startTime}
                      endTime={item.endTime}
                    />
                    <OwnerBadge
                      owned={Boolean(currentUserId && item.sellerId === currentUserId)}
                      className="absolute right-3 top-3"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="font-label text-sm font-bold uppercase leading-4 text-lot-orange">
                      {item.lotLabel}
                    </p>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-headline text-xl font-semibold leading-6 text-brand-900 underline-offset-2 group-hover:underline dark:text-on-surface">
                        {item.title}
                      </h3>
                      <BodyText className="text-sm font-light leading-4 text-brand-500 dark:text-on-surface-variant">
                        {item.artistName}
                      </BodyText>
                    </div>
                    {(() => {
                      const emphasis = item.priceEmphasis ?? "estimate";
                      const valueClass =
                        emphasis === "currentBid" || emphasis === "both"
                          ? "font-headline text-base font-semibold leading-5 text-brand-900 dark:text-on-surface"
                          : "font-body text-sm font-medium leading-6 text-brand-400 dark:text-on-surface-variant";
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-body text-xs font-normal leading-4 text-brand-400 dark:text-on-surface-variant">
                            {item.priceLabel}
                          </span>
                          <span className={valueClass}>{item.priceFormatted}</span>
                        </div>
                      );
                    })()}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
