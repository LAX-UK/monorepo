import { LotCardTimer } from "@/components/lot-timer";
import { WatchlistHeart } from "@/components/marketing/watchlist-heart";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { lotImageTransitionStyle } from "@/lib/view-transitions";
import { DisplayHeading, SectionHeader } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight, Eye } from "lucide-react";
import Link from "next/link";

type Props = {
  items: LotCardVM[];
};

const VIEW_ALL_HREF = "/search?ending=24h";

function EndingSoonSectionHeader() {
  return (
    <SectionHeader
      heading={
        <DisplayHeading
          as="h2"
          id="home-ending-soon-heading"
          className="text-[40px] font-semibold leading-[60px] text-[#050505] dark:text-on-surface"
        >
          Ending Soon
        </DisplayHeading>
      }
      action={
        <Button variant="chevron" asChild>
          <Link href={VIEW_ALL_HREF} className="inline-flex items-center gap-[11px] py-[18px]">
            <span className="text-center text-base font-semibold leading-6 tracking-[0.05em] text-[#050505] dark:text-on-surface">
              View all
            </span>
            <span className="sr-only"> lots ending in the next 24 hours</span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </Button>
      }
    />
  );
}

type EndingSoonLotCardProps = {
  item: LotCardVM;
  index: number;
};

/** Figma B3 lot tile: fixed 340px art, glass live tag, dual price rows, bid row. */
function EndingSoonLotCard({ item, index }: EndingSoonLotCardProps) {
  const revealDelay = `${Math.min(index * 80, 320)}ms`;
  const rows = item.endingSoonPriceRows;

  return (
    <article
      className="fade-up flex min-w-0 w-full flex-col gap-4"
      style={{ ["--reveal-delay" as string]: revealDelay }}
    >
      <div
        className="group relative flex h-[340px] w-full flex-col overflow-hidden bg-page-bg"
        style={lotImageTransitionStyle(item.id)}
      >
        <Link
          href={item.href}
          className="absolute inset-0 z-0 outline-offset-4 focus-visible:z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`${item.title} — view artwork`}
        >
          <RevealInView
            className="absolute inset-0 overflow-hidden"
            innerClassName="absolute inset-0"
            delayMs={Math.min(index * 70, 280)}
          >
            <MediaImage
              src={item.imageUrl}
              alt={item.imageAlt}
              label="Lot artwork"
              imgClassName="h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </RevealInView>
        </Link>
        <LotCardTimer
          variant="endingSoon"
          status={item.status}
          startTime={item.startTime}
          endTime={item.endTime}
        />
        <WatchlistHeart
          lotTitle={item.title}
          className="pointer-events-auto absolute right-3 top-3 z-10"
        />
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={item.href}
            className="group text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
          >
            {item.title}
          </Link>
          <p className="text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
            {item.artistName}
          </p>
        </div>

        {rows ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                {rows.estimate.label}
              </span>
              <span className="text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
                {rows.estimate.value}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                {rows.current.label}
              </span>
              <span className="text-sm font-medium leading-6 text-[#474747] dark:text-on-surface-variant">
                {rows.current.value}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">{item.priceLabel}</span>
            <span className="text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
              {item.priceFormatted}
            </span>
          </div>
        )}

        <div className="inline-flex w-full items-start gap-6">
          <Link
            href={item.href}
            className="flex h-10 flex-1 items-center justify-center rounded border border-[#A3A3A3] bg-transparent text-center text-base font-semibold leading-6 tracking-[0.05em] text-[#0A0A0A] outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-neutral-500 dark:text-on-surface dark:hover:bg-white/[0.06]"
          >
            Bid
          </Link>
          <Link
            href={item.href}
            aria-label={`View details for ${item.title}`}
            className="flex h-10 items-center justify-center rounded px-2.5 text-[#0A0A0A] outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-on-surface dark:hover:bg-white/[0.06]"
          >
            <Eye className="size-5 shrink-0" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Ending Soon. Renders only when there are active lots ending within 24h
 *  (excluding the hero lot). Data shaping lives in `getHomeData` / view-models.
 */
export function LaxEndingSoon({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="home-ending-soon-heading"
      className="cv-auto mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pt-10 md:px-10 lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <EndingSoonSectionHeader />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <EndingSoonLotCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
