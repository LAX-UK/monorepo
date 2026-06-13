import {
  MarketingCardReveal,
  MarketingSectionReveal,
} from "@/components/marketing/marketing-reveal";
import { PRIVATE_SALE_COPY } from "@/components/sections/home/home-copy";
import type { PrivateSaleHighlightVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { DisplayHeading, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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
      className={cn(MARKETING_PAGE_SHELL, "cv-auto pt-[var(--section-spacing-tight)]")}
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
        <div className="flex max-w-[640px] flex-col gap-6">
          <MarketingSectionReveal index={0}>
            <DisplayHeading
              as="h2"
              id="private-sale-heading"
              size="section"
              className="font-semibold text-on-surface"
            >
              {PRIVATE_SALE_COPY.heading}
            </DisplayHeading>
          </MarketingSectionReveal>
          <MarketingSectionReveal index={1}>
            <p className="font-body text-[20px] font-normal leading-[1.4] text-on-surface-variant">
              {PRIVATE_SALE_COPY.subtitle}
            </p>
          </MarketingSectionReveal>
          <MarketingSectionReveal index={2}>
            <Button variant="outline" asChild className="min-h-[44px] gap-2 px-5">
              <Link href={PRIVATE_SALE_COPY.ctaHref}>
                {PRIVATE_SALE_COPY.cta}
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </Button>
          </MarketingSectionReveal>
        </div>

        <MarketingCardReveal
          index={0}
          className="flex w-full shrink-0 flex-col gap-3 lg:max-w-[676px]"
        >
          <Link
            href={featured.href}
            className="group block outline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="relative aspect-[676/400] w-full overflow-hidden bg-page-bg">
              <MediaImage
                src={featured.imageUrl}
                alt={featured.imageAlt}
                label="Private sale highlight"
                imgClassName="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                sizes="(max-width: 1024px) 100vw, 676px"
              />
            </div>
          </Link>
        </MarketingCardReveal>
      </div>
    </section>
  );
}
