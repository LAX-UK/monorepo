import { PRIVATE_SALE_COPY } from "@/components/sections/home/home-copy";
import type { PrivateSaleHighlightVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { cn } from "@auction/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type PrivateSaleHighlightsMarketingProps = {
  /** Non-empty list; the first entry supplies the feature image and lot link. */
  highlights: PrivateSaleHighlightVM[];
};

/** Presentational B5 block — copy + outlined CTA + feature image (Figma). */
export function PrivateSaleHighlightsMarketing({
  highlights,
}: PrivateSaleHighlightsMarketingProps) {
  const featured = highlights[0];
  if (!featured) return null;

  return (
    <section
      aria-labelledby="private-sale-heading"
      className="cv-auto mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pt-[var(--section-spacing)] md:px-10 lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
        <div className="flex max-w-[640px] flex-col gap-6">
          <RevealInView variant="fadeUp">
            <h2
              id="private-sale-heading"
              className="font-headline text-[40px] font-semibold leading-[1.15] tracking-normal text-[#050505] dark:text-on-surface"
            >
              {PRIVATE_SALE_COPY.heading}
            </h2>
          </RevealInView>
          <RevealInView variant="fadeUp" delayMs={60}>
            <p className="font-body text-[20px] font-normal leading-[1.4] text-[#474747] dark:text-on-surface-variant">
              {PRIVATE_SALE_COPY.subtitle}
            </p>
          </RevealInView>
          <RevealInView variant="fadeUp" delayMs={120}>
            <Link
              href={PRIVATE_SALE_COPY.ctaHref}
              className={cn(
                "inline-flex min-h-[44px] w-fit items-center gap-2 rounded-sm border border-[#A3A3A3] bg-transparent px-5 py-3 font-body text-base font-semibold leading-none tracking-[0.8px] text-[#0A0A0A] outline-offset-4 transition-colors",
                "hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-on-surface-variant dark:text-on-surface dark:hover:bg-white/[0.04]",
              )}
            >
              {PRIVATE_SALE_COPY.cta}
              <ChevronRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          </RevealInView>
        </div>

        <RevealInView variant="wipeZoom" delayMs={80} className="w-full shrink-0 lg:max-w-[676px]">
          <Link
            href={featured.href}
            className="group block outline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="relative aspect-[676/400] w-full overflow-hidden bg-page-bg">
              <MediaImage
                src={featured.imageUrl}
                alt={featured.imageAlt}
                label="Private sale highlight"
                imgClassName="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                sizes="(max-width: 1024px) 100vw, 676px"
              />
            </div>
          </Link>
        </RevealInView>
      </div>
    </section>
  );
}
