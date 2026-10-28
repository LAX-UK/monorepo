import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import {
  MarketingCardReveal,
  MarketingCardRow,
  MarketingEditorialCard,
  type MarketingEditorialCardProps,
} from "@auction/marketing-ui";

type ArtEditorialCardProps = {
  card: EditorialCardVm;
  priority?: boolean;
  /** `wide` is for a lead that spans the content width above other cards. */
  aspect?: Extract<MarketingEditorialCardProps["aspect"], "landscape" | "wide">;
  /** `split` for a card alone in its row: media and text side by side. */
  layout?: MarketingEditorialCardProps["layout"];
};

const SIZES = {
  landscape: "(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw",
  wide: "(min-width: 90rem) 1360px, 100vw",
  split: "(min-width: 48rem) 55vw, 100vw",
} as const;

/**
 * Maps Art's editorial VM onto the shared card. CMS links go through `ArtEditorialLink`. The
 * heart slot stays empty until exhibitions and stories can be saved (no backend yet).
 */
export function ArtEditorialCard({
  card,
  priority = false,
  aspect = "landscape",
  layout = "stacked",
}: ArtEditorialCardProps) {
  return (
    <MarketingEditorialCard
      data-testid="art-editorial-card"
      aspect={aspect}
      layout={layout}
      href={card.href}
      linkAs={ArtEditorialLink}
      title={card.headline}
      kicker={[card.kicker, card.kickerDetail].filter((part): part is string => Boolean(part))}
      details={card.meta ? [card.meta] : []}
      media={
        <ArtMediaImage
          src={card.imageUrl}
          alt=""
          label={card.kicker ?? "lax.art"}
          sizes={layout === "split" ? SIZES.split : SIZES[aspect]}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
    />
  );
}

/**
 * Editorial cards in a row that recomposes for its count: one card spans the width with a wide
 * image, two sit side by side, three or more fill the grid.
 */
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
    <MarketingCardRow
      aria-label={ariaLabel}
      items={cards}
      getKey={(card) => card.key}
      renderItem={(card, layout, index) => (
        <MarketingCardReveal index={index}>
          <ArtEditorialCard
            card={card}
            layout={layout === "feature" ? "split" : "stacked"}
            priority={index < priorityCount}
          />
        </MarketingCardReveal>
      )}
    />
  );
}
