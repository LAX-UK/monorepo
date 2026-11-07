import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { EditionCardVm } from "@/lib/catalogue/edition-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingBellIcon, MarketingWorkCard } from "@auction/marketing-ui";
import Link from "next/link";

export type ShopEditionCardProps = {
  card: EditionCardVm;
  /** h2 on a listing page, h3 inside a titled section. */
  titleAs?: "h2" | "h3";
  /** Leave out the artist's name, e.g. on the artist's own page. */
  hideArtist?: boolean;
  /** Above-the-fold cards load their image first. */
  priority?: boolean;
  sizes?: string;
};

const DEFAULT_SIZES = "(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw";

const BADGE_CLASS =
  "inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 font-body text-xs font-medium leading-5 text-on-surface shadow-sm";

/**
 * The Shop card for one work, on the shared LAX works card: the work whole on its mat, the title,
 * the artist, one facts line and the price ("From £95 · 3 versions" when the work has several).
 * "New" and "Sold out" sit on the mat; a sold-out work offers "Get alerts" in place of the price.
 */
export function ShopEditionCard({
  card,
  titleAs = "h3",
  hideArtist = false,
  priority = false,
  sizes = DEFAULT_SIZES,
}: ShopEditionCardProps) {
  const status = card.status;
  return (
    <MarketingWorkCard
      data-testid="shop-edition-card"
      href={card.href}
      title={card.title}
      titleAs={titleAs}
      media={
        <ShopMediaImage
          src={card.imageUrl}
          alt={card.imageAlt}
          label={SHOP_MEDIA_LABELS.artwork}
          sizes={sizes}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
        />
      }
      {...(status ? { mediaBadge: <span className={BADGE_CLASS}>{status.label}</span> } : {})}
      {...(hideArtist
        ? {}
        : {
            subtitle: (
              <Link
                href={card.artistHref}
                className="shop-focus-ring rounded-sm hover:text-on-surface hover:underline"
              >
                {card.artistName}
              </Link>
            ),
          })}
      {...(card.factsLine ? { details: <p>{card.factsLine}</p> } : {})}
      {...(status?.kind === "sold_out"
        ? {
            footer: (
              <Link
                href={status.alertHref}
                className="shop-edition-card__alert shop-focus-ring"
                aria-label={`${status.alertLabel} for ${card.title}`}
              >
                <MarketingBellIcon className="shop-edition-card__alert-icon" />
                {status.alertLabel}
              </Link>
            ),
          }
        : card.priceLabel
          ? { footer: <p className="tabular-nums">{card.priceLabel}</p> }
          : {})}
    />
  );
}
