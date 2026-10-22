import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import {
  MarketingCardReveal,
  MarketingEditorialCard,
  type MarketingEditorialCardProps,
} from "@auction/marketing-ui";

type ArtEditorialCardProps = {
  card: EditorialCardVm;
  priority?: boolean;
  /** `wide` is for a lead that spans the content width. */
  aspect?: Extract<MarketingEditorialCardProps["aspect"], "landscape" | "wide">;
};

const SIZES = {
  landscape: "(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw",
  wide: "(min-width: 90rem) 1360px, 100vw",
} as const;

/**
 * Maps Art's editorial VM onto the shared card. CMS links go through `ArtEditorialLink`. The
 * heart slot stays empty until exhibitions and stories can be saved (no backend yet).
 */
export function ArtEditorialCard({
  card,
  priority = false,
  aspect = "landscape",
}: ArtEditorialCardProps) {
  return (
    <MarketingEditorialCard
      data-testid="art-editorial-card"
      aspect={aspect}
      href={card.href}
      linkAs={ArtEditorialLink}
      title={card.headline}
      kicker={[card.kicker, card.place].filter((part): part is string => Boolean(part))}
      details={card.meta ? [card.meta] : []}
      media={
        <ArtMediaImage
          src={card.imageUrl}
          alt=""
          label={card.kicker ?? "LAX Art"}
          sizes={SIZES[aspect]}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
    />
  );
}

export function ArtEditorialCardGrid({
  cards,
  ariaLabel,
  priorityCount = 0,
}: {
  cards: readonly EditorialCardVm[];
  ariaLabel: string;
  priorityCount?: number;
}) {
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-label={ariaLabel}>
      {cards.map((card, index) => (
        <li key={card.key}>
          <MarketingCardReveal index={index}>
            <ArtEditorialCard card={card} priority={index < priorityCount} />
          </MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
