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

/** Figma card: square media, 2-line title, artist, meta line, price, Enquire, heart. */
export function ArtArtworkCard({ card, favoriteAuth, priority = false }: ArtArtworkCardProps) {
  return (
    <MarketingCardShell
      interactive={false}
      className="flex h-full flex-col bg-transparent"
      data-testid="art-artwork-card"
    >
      <div className="relative">
        <MarketingCardMedia className="aspect-square rounded-md bg-surface-container">
          <Link href={card.href} tabIndex={-1} className="absolute inset-0 block">
            <ArtMediaImage
              src={card.imageUrl}
              alt={card.imageAlt}
              label={ART_MEDIA_LABELS.artwork}
              aspect={[1, 1]}
              sizes="(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw"
              priority={priority}
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          </Link>
        </MarketingCardMedia>
        <div className="absolute right-1 top-1">
          <ArtArtworkFavoriteToggle
            slug={card.slug}
            title={card.title}
            initialSaved={card.saved}
            auth={favoriteAuth}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <h3 className="line-clamp-2 font-headline text-base font-semibold leading-snug text-on-surface">
          <Link href={card.href} className="art-focus-ring rounded-sm hover:underline">
            {card.title}
          </Link>
        </h3>
        <Link
          href={card.artistHref}
          className="art-focus-ring w-fit rounded-sm text-sm text-on-surface-variant hover:text-on-surface"
        >
          {card.artistName}
        </Link>
        {card.metaLine ? (
          <p className="line-clamp-1 text-xs text-on-surface-variant">{card.metaLine}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 pt-2">
          {card.priceLabel ? (
            <p className="text-sm font-medium text-on-surface">{card.priceLabel}</p>
          ) : (
            <span />
          )}
          {card.enquireHref ? (
            <Button variant="underline" asChild>
              <Link href={card.enquireHref}>
                Enquire<span className="sr-only"> about {card.title}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </MarketingCardShell>
  );
}
