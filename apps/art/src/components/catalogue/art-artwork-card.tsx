import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingWorkCard } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type ArtArtworkCardProps = {
  card: CatalogueArtworkCardVm;
  favoriteAuth: ArtFavoriteAuth;
  priority?: boolean;
};

/**
 * Artwork card on the shared LAX works card: the work shown whole on a mat, title with an inline
 * heart, artist, meta, price and Enquire. Below `md` only title, heart and artist show
 * (Figma `546:9559`).
 */
export function ArtArtworkCard({ card, favoriteAuth, priority = false }: ArtArtworkCardProps) {
  const hasFooter = Boolean(card.priceLabel || card.enquireHref);
  return (
    <MarketingWorkCard
      data-testid="art-artwork-card"
      href={card.href}
      title={card.title}
      media={
        <ArtMediaImage
          src={card.imageUrl}
          alt={card.imageAlt}
          label={ART_MEDIA_LABELS.artwork}
          sizes="(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw"
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
        />
      }
      action={
        <ArtArtworkFavoriteToggle
          slug={card.slug}
          title={card.title}
          initialSaved={card.saved}
          auth={favoriteAuth}
          appearance="bare"
          size="sm"
        />
      }
      subtitle={
        <Link
          href={card.artistHref}
          className="art-focus-ring rounded-sm hover:text-on-surface hover:underline"
        >
          {card.artistName}
        </Link>
      }
      {...(card.metaLine
        ? {
            details: (
              <div className="hidden md:block" data-testid="art-artwork-card-details">
                <p className="line-clamp-1">{card.metaLine}</p>
              </div>
            ),
          }
        : {})}
      {...(hasFooter
        ? {
            footer: (
              <div className="hidden flex-col items-start gap-2 md:flex">
                {card.priceLabel ? <p>{card.priceLabel}</p> : null}
                {card.enquireHref ? (
                  <Button
                    variant="underline"
                    className="text-sm font-medium normal-case tracking-normal"
                    asChild
                  >
                    <Link href={card.enquireHref}>
                      Enquire<span className="sr-only"> about {card.title}</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            ),
          }
        : {})}
    />
  );
}
