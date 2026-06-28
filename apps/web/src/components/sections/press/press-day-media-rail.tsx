import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import type { PressDayMediaSaleVM } from "@/components/sections/press/mappers";
import { HorizontalCarousel } from "@/components/ui/horizontal-carousel";
import { SITE_NAME, SITE_PRESS_EMAIL } from "@/lib/brand";
import {
  FOCUS_RING,
  MARKETING_CARD_LIFT,
  MARKETING_CARD_MEDIA_HOVER,
  MARKETING_PROSE_LINK,
} from "@/lib/marketing/chrome";
import { DisplayHeading, cn } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  items: PressDayMediaSaleVM[];
  variant?: "grid" | "carousel";
};

function DayMediaCard({ item }: { item: PressDayMediaSaleVM }) {
  return (
    <Link
      href={item.galleryHref}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest hover:border-outline-variant/60",
        MARKETING_CARD_LIFT,
        FOCUS_RING,
      )}
    >
      <div className="relative aspect-[16/10] bg-surface-container-low">
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={`Auction day photo from ${item.title}`}
            fill
            className={cn("object-cover", MARKETING_CARD_MEDIA_HOVER)}
            sizes="(max-width: 1024px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-body text-sm text-on-surface-variant">
            {item.dayImageCount} media items
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="font-headline text-base font-semibold text-on-surface group-hover:text-link">
          {item.title}
        </p>
        <p className="font-body text-xs text-on-surface-variant">
          {item.dayImageCount} auction day {item.dayImageCount === 1 ? "item" : "items"}
          {item.endDateLabel ? ` · ${item.endDateLabel}` : null}
        </p>
      </div>
    </Link>
  );
}

export function PressDayMediaRail({ items, variant = "carousel" }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      id="press-day-media"
      aria-labelledby="press-day-media-title"
      className="flex flex-col gap-6"
    >
      <MarketingSectionHeader
        heading={
          <DisplayHeading
            as="h2"
            id="press-day-media-title"
            size="section"
            className="font-semibold text-on-surface"
          >
            Auction day photos
          </DisplayHeading>
        }
        subtitle="Saleroom photography and video from recent onsite and hybrid sales."
      />
      <p className="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">
        Images on sale pages are available for editorial reporting on these auctions. Credit{" "}
        {SITE_NAME} where shown. For high-resolution files or broadcast use, contact{" "}
        <a href={`mailto:${SITE_PRESS_EMAIL}`} className={MARKETING_PROSE_LINK}>
          {SITE_PRESS_EMAIL}
        </a>
        .
      </p>
      {variant === "carousel" ? (
        <HorizontalCarousel ariaLabel="Auction day photos">
          {items.map((item, index) => (
            <MarketingCardReveal key={item.id} index={index} className="h-full min-w-0">
              <DayMediaCard item={item} />
            </MarketingCardReveal>
          ))}
        </HorizontalCarousel>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <MarketingCardReveal index={index} className="h-full min-w-0">
                <DayMediaCard item={item} />
              </MarketingCardReveal>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
