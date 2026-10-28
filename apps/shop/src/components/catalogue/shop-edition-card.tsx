import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { EditionCardVm } from "@/lib/catalogue/edition-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingBellIcon } from "@auction/marketing-ui";
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
  /**
   * `side` sets the mat beside the caption (five parts to four), for a pair of editions that
   * would otherwise leave half a row empty; the caption ends with a "See the edition" cue.
   */
  layout?: "stacked" | "side";
};

const SEE_EDITION_CUE = "See the edition";

const DEFAULT_SIZES = "(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw";

/**
 * The Shop product card, everywhere a list of editions appears: the work whole on a paper mat,
 * then the artist, the title, technique and edition size, and the price or "Sold out" in its
 * place. The title is the card's one link and stretches over the whole card; a sold-out card adds
 * "Get alerts", which sits above that stretched link so both can be reached.
 */
export function ShopEditionCard({
  card,
  titleAs: Title = "h3",
  hideArtist = false,
  priority = false,
  sizes = DEFAULT_SIZES,
  layout = "stacked",
}: ShopEditionCardProps) {
  const status = card.status;
  return (
    <article
      className="shop-edition-card"
      data-status={status?.kind ?? "none"}
      data-layout={layout}
    >
      <div className="shop-edition-card__mat marketing-work-mat">
        <span className="shop-edition-card__print">
          <ShopMediaImage
            src={card.imageUrl}
            alt={card.imageAlt}
            label={SHOP_MEDIA_LABELS.artwork}
            sizes={sizes}
            priority={priority}
            className="absolute inset-0 size-full"
            imgClassName="object-contain"
          />
        </span>
      </div>
      <div className="shop-edition-card__body">
        {hideArtist && status?.kind !== "new" ? null : (
          <p className="shop-edition-card__artist">
            {hideArtist ? null : (
              <span className="shop-edition-card__artist-name">{card.artistName}</span>
            )}
            {status?.kind === "new" ? (
              <span className="shop-edition-card__new">{status.label}</span>
            ) : null}
          </p>
        )}
        <Title className="shop-edition-card__title">
          <Link href={card.href} className="shop-edition-card__link">
            {card.title}
          </Link>
        </Title>
        {card.factsLine ? <p className="shop-edition-card__facts">{card.factsLine}</p> : null}
        {status?.kind === "sold_out" ? (
          <p className="shop-edition-card__sold">
            <span>{status.label}</span>
            <Link
              href={status.alertHref}
              className="shop-edition-card__alert shop-focus-ring"
              aria-label={`${status.alertLabel} for ${card.title}`}
            >
              <MarketingBellIcon className="shop-edition-card__alert-icon" />
              {status.alertLabel}
            </Link>
          </p>
        ) : card.priceLabel ? (
          <p className="shop-edition-card__price">{card.priceLabel}</p>
        ) : null}
        {layout === "side" ? (
          // The title's link already covers the card; this only says where it leads.
          <span className="shop-edition-card__cue" aria-hidden="true">
            {SEE_EDITION_CUE}
          </span>
        ) : null}
      </div>
    </article>
  );
}
