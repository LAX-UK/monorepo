import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCardMedia, MarketingCardReveal, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

export type ArtArtistGridProps = {
  cards: readonly CatalogueArtistCardVm[];
  "aria-label"?: string;
};

/** Circular portrait, name and caption; shared by the artist grid and the home artist rail. */
export function ArtArtistCard({ card }: { card: CatalogueArtistCardVm }) {
  return (
    <MarketingCardShell asChild className="bg-transparent">
      <Link href={card.href} className="flex flex-col items-center gap-3 text-center">
        <MarketingCardMedia className="aspect-square w-full max-w-40 rounded-full bg-surface-container">
          <ArtMediaImage
            src={card.image}
            alt={card.imageAlt}
            label={ART_MEDIA_LABELS.artistPortrait}
            aspect={[1, 1]}
            shape="circle"
            sizes="10rem"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </MarketingCardMedia>
        <span className="font-headline text-sm font-semibold text-on-surface">{card.name}</span>
        {card.caption ? (
          <span className="-mt-2 text-xs text-on-surface-variant">{card.caption}</span>
        ) : null}
      </Link>
    </MarketingCardShell>
  );
}

export function ArtArtistGrid({ cards, "aria-label": ariaLabel }: ArtArtistGridProps) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6"
      aria-label={ariaLabel}
      data-testid="art-artist-grid"
    >
      {cards.map((card, index) => (
        <li key={card.slug}>
          <MarketingCardReveal index={index}>
            <ArtArtistCard card={card} />
          </MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
