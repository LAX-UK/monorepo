import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { lotImageTransitionStyle } from "@/lib/view-transitions";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingLotTileProps = {
  lotId: string;
  index: number;
  href: string;
  linkAriaLabel: string;
  imageUrl: string | null;
  imageAlt: string;
  sizes: string;
  cornerAction?: ReactNode;
  topOverlay?: ReactNode;
  belowImage: ReactNode;
};

/** Shared 340px marketing hero shell for home lot tiles (Editor’s Picks + Urgency). */
export function MarketingLotTile({
  lotId,
  index,
  href,
  linkAriaLabel,
  imageUrl,
  imageAlt,
  sizes,
  cornerAction,
  topOverlay,
  belowImage,
}: MarketingLotTileProps) {
  const revealDelay = `${Math.min(index * 80, 320)}ms`;

  return (
    <article
      className="fade-up flex min-w-0 w-full flex-col gap-4"
      style={{ ["--reveal-delay" as string]: revealDelay }}
    >
      <div
        className="group relative flex h-[340px] w-full flex-col overflow-hidden bg-page-bg"
        style={lotImageTransitionStyle(lotId)}
      >
        <Link
          href={href}
          className="absolute inset-0 z-0 outline-offset-4 focus-visible:z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={linkAriaLabel}
        >
          <RevealInView
            className="absolute inset-0 overflow-hidden"
            innerClassName="absolute inset-0"
            delayMs={Math.min(index * 70, 280)}
          >
            <MediaImage
              src={imageUrl}
              alt={imageAlt}
              label="Lot artwork"
              imgClassName="h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
              sizes={sizes}
            />
          </RevealInView>
        </Link>
        {topOverlay}
        {cornerAction}
      </div>
      {belowImage}
    </article>
  );
}
