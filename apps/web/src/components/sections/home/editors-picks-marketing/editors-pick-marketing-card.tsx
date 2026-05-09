import { WatchlistHeart } from "@/components/marketing/watchlist-heart";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { lotImageTransitionStyle } from "@/lib/view-transitions";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  lot: EditorsPickLotCardVM;
  index: number;
};

/** Presentational tile for the home “Editor’s Picks” strip (Figma). */
export function EditorsPickMarketingCard({ lot, index }: Props) {
  const revealDelay = `${Math.min(index * 80, 320)}ms`;

  return (
    <article
      className="fade-up flex w-full flex-col gap-4"
      style={{ ["--reveal-delay" as string]: revealDelay }}
    >
      <div
        className="group relative flex h-[340px] w-full flex-col overflow-hidden bg-page-bg"
        style={lotImageTransitionStyle(lot.id)}
      >
        <Link
          href={lot.href}
          className="absolute inset-0 z-0 outline-offset-4 focus-visible:z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`${lot.title} — view artwork`}
        >
          <RevealInView
            className="absolute inset-0 overflow-hidden"
            innerClassName="absolute inset-0"
            delayMs={Math.min(index * 70, 280)}
          >
            <MediaImage
              src={lot.imageUrl}
              alt={lot.imageAlt}
              label="Lot artwork"
              imgClassName="h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
              sizes="280px"
            />
          </RevealInView>
        </Link>
        <WatchlistHeart
          lotTitle={lot.title}
          className="pointer-events-auto absolute right-3 top-3 z-10"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={lot.href}
            className="font-headline text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
          >
            {lot.title}
          </Link>
          <p className="font-body text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
            {lot.artistName}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-body text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
            {lot.estimateLabel}
          </span>
          <span className="font-body text-sm font-medium leading-4 text-[#474747] dark:text-on-surface-variant">
            {lot.estimateValue}
          </span>
        </div>
        <Button
          variant="outline"
          asChild
          className="h-10 w-full rounded border-[#A3A3A3] text-base font-semibold tracking-[0.05em] text-[#0A0A0A] dark:border-neutral-500 dark:text-on-surface"
        >
          <Link href={lot.href}>View Lot</Link>
        </Button>
      </div>
    </article>
  );
}
