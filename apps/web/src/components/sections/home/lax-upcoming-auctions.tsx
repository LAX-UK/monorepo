import type { UpcomingAuctionVM } from "@/components/sections/home/home-view-models";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { BodyText, DisplayHeading } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  auction: UpcomingAuctionVM;
};

export function LaxUpcomingAuctions({ auction }: Props) {
  return (
    <section className="w-full max-w-[1440px] px-8 pb-0 pt-20 md:px-8">
      <div className="mx-auto flex max-w-[1376px] flex-col gap-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <DisplayHeading
            as="h2"
            className="text-[40px] font-semibold leading-[60px] text-brand-900"
          >
            Upcoming Auctions
          </DisplayHeading>
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
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-8">
          <div className="group flex min-w-0 flex-[853] flex-col gap-6">
            <Link href={auction.href} className="block">
              <div className="relative aspect-[853/500] w-full overflow-hidden bg-brand-800">
                {auction.coverImageUrl ? (
                  <Image
                    src={auction.coverImageUrl}
                    alt={auction.coverImageAlt}
                    fill
                    placeholder="blur"
                    blurDataURL={TINY_IMAGE_BLUR}
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, 853px"
                  />
                ) : null}
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <BodyText className="text-base font-normal uppercase leading-4 text-brand-500">
                  {auction.dateLabel}
                </BodyText>
                <DisplayHeading as="h3" className="text-2xl font-semibold leading-6 text-brand-900">
                  {auction.title}
                </DisplayHeading>
              </div>
            </Link>
          </div>
          <div className="flex w-full min-w-0 flex-[507] flex-col gap-8">
            <DisplayHeading as="h3" className="text-2xl font-semibold leading-6 text-brand-900">
              Featured Lots
            </DisplayHeading>
            <div className="flex flex-col gap-6">
              {auction.featuredLots.map((lot) => (
                <div key={lot.id} className="flex flex-row gap-4">
                  <Link
                    href={lot.href}
                    className="relative block h-[210px] w-[min(45%,181.5px)] shrink-0 overflow-hidden bg-brand-800"
                  >
                    {lot.imageUrl ? (
                      <Image
                        src={lot.imageUrl}
                        alt={lot.imageAlt}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover"
                        sizes="182px"
                      />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-start gap-3 py-1">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={lot.href}
                        className="font-headline text-xl font-semibold leading-6 text-brand-900 hover:underline"
                      >
                        {lot.title}
                      </Link>
                      <BodyText className="text-sm font-light leading-4 text-brand-500">
                        {lot.artistName}
                      </BodyText>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-body text-xs font-normal leading-4 text-brand-400">
                        Estimate
                      </span>
                      <span className="font-body text-sm font-medium leading-6 text-brand-400">
                        {lot.estimateFormatted}
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
