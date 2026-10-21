import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type ArtArtworkCardProps = {
  card: CatalogueArtworkCardVm;
  favoriteAuth: ArtFavoriteAuth;
  priority?: boolean;
};

/**
 * Figma card (`175:5143`): portrait media, title with an inline heart, artist, meta, price and
 * Enquire. Below `md` only title, heart and artist show (`546:9559`).
 */
export function ArtArtworkCard({ card, favoriteAuth, priority = false }: ArtArtworkCardProps) {
  return (
    <MarketingCardShell
      interactive={false}
      className="flex h-full flex-col rounded-none bg-transparent"
      data-testid="art-artwork-card"
    >
      <MarketingCardMedia className="aspect-[8/11] bg-surface-container">
        <Link href={card.href} tabIndex={-1} className="absolute inset-0 block">
          <ArtMediaImage
            src={card.imageUrl}
            alt={card.imageAlt}
            label={ART_MEDIA_LABELS.artwork}
            aspect={[8, 11]}
            sizes="(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw"
            priority={priority}
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </Link>
      </MarketingCardMedia>
      <div className="flex flex-1 flex-col pt-3 md:pt-4">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 font-headline text-base font-normal leading-6 text-on-surface md:text-lg md:leading-[1.625rem]">
            <Link href={card.href} className="art-focus-ring rounded-sm hover:underline">
              {card.title}
            </Link>
          </h3>
          <ArtArtworkFavoriteToggle
            slug={card.slug}
            title={card.title}
            initialSaved={card.saved}
            auth={favoriteAuth}
            appearance="bare"
            size="sm"
            className="-mr-2.5 -mt-2.5 shrink-0"
          />
        </div>
        <Link
          href={card.artistHref}
          className="art-focus-ring mt-1 w-fit rounded-sm text-sm text-on-surface-variant hover:text-on-surface md:mt-2 md:text-base"
        >
          {card.artistName}
        </Link>
        <div className="hidden flex-1 flex-col md:flex" data-testid="art-artwork-card-details">
          {card.metaLine ? (
            <p className="mt-2 line-clamp-1 text-base text-on-surface-variant">{card.metaLine}</p>
          ) : null}
          <div className="mt-auto flex flex-col items-start gap-2 pt-6">
            {card.priceLabel ? (
              <p className="text-sm font-medium text-on-surface">{card.priceLabel}</p>
            ) : null}
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
        </div>
      </div>
    </MarketingCardShell>
  );
}
