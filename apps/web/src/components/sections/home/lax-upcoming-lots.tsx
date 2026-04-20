import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { BodyText, DisplayHeading } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  items: LotCardVM[];
  saleMetaLine: string;
};

export function LaxUpcomingLots({ items, saleMetaLine }: Props) {
  return (
    <section className="w-full max-w-[1440px] px-8 pb-0 pt-10 md:px-8">
      <div className="mx-auto flex max-w-[1376px] flex-col gap-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-[1278px] flex-col gap-3">
            <LiveIndicatorRow
              tone="light"
              progressLabel="Auction in progress"
              saleLine={saleMetaLine}
            />
            <DisplayHeading
              as="h2"
              className="text-[40px] font-semibold leading-[60px] text-brand-900"
            >
              Upcoming Lots
            </DisplayHeading>
          </div>
          <Link
            href="/sales"
            className="inline-flex items-center gap-[11px] self-start py-[18px] font-label text-base font-semibold leading-6 tracking-[0.8px] text-brand-900 sm:self-auto"
          >
            View All
            <span
              className="inline-block h-5 w-5 border-r-[1.67px] border-b-[1.67px] border-brand-900 rotate-[-45deg]"
              aria-hidden
            />
          </Link>
        </div>
        {items.length === 0 ? (
          <BodyText className="text-brand-400">No upcoming lots to display.</BodyText>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <article key={item.id} className="flex flex-col gap-4">
                <Link href={item.href} className="group block">
                  <div className="relative aspect-[320/340] w-full overflow-hidden bg-brand-800">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : null}
                  </div>
                </Link>
                <div className="flex flex-col gap-3">
                  <p className="font-label text-sm font-bold uppercase leading-4 text-lot-orange">
                    {item.lotLabel}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={item.href}
                      className="font-headline text-xl font-semibold leading-6 text-brand-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <BodyText className="text-sm font-light leading-4 text-brand-500">
                      {item.artistName}
                    </BodyText>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-body text-xs font-normal leading-4 text-brand-400">
                      Estimate
                    </span>
                    <span className="font-body text-sm font-medium leading-6 text-brand-400">
                      {item.estimateFormatted}
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
