import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { RevealInView } from "@/components/ui/reveal";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
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
    <section className="w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-8">
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
              <Link href="/sales" className="inline-flex items-center gap-2 py-[18px]">
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
            {items.map((item) => (
              <article key={item.id} className="flex flex-col gap-4">
                <Link href={item.href} className="group block">
                  <div className="relative aspect-[320/340] w-full overflow-hidden bg-brand-800 dark:bg-surface-container-high">
                    {item.imageUrl ? (
                      <RevealInView
                        className="absolute inset-0 overflow-hidden"
                        innerClassName="absolute inset-0"
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.imageAlt}
                          fill
                          placeholder="blur"
                          blurDataURL={TINY_IMAGE_BLUR}
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      </RevealInView>
                    ) : null}
                    <OwnerBadge
                      owned={Boolean(currentUserId && item.sellerId === currentUserId)}
                      className="absolute right-3 top-3"
                    />
                  </div>
                </Link>
                <div className="flex flex-col gap-3">
                  <p className="font-label text-sm font-bold uppercase leading-4 text-lot-orange">
                    {item.lotLabel}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={item.href}
                      className="font-headline text-xl font-semibold leading-6 text-brand-900 hover:underline dark:text-on-surface"
                    >
                      {item.title}
                    </Link>
                    <BodyText className="text-sm font-light leading-4 text-brand-500 dark:text-on-surface-variant">
                      {item.artistName}
                    </BodyText>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-body text-xs font-normal leading-4 text-brand-400 dark:text-on-surface-variant">
                      {item.priceLabel}
                    </span>
                    <span className="font-body text-sm font-medium leading-6 text-brand-400 dark:text-on-surface-variant">
                      {item.priceFormatted}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
