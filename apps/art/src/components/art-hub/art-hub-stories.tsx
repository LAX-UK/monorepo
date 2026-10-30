import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import { ArtSectionHeader } from "@/components/layout/art-section";
import { ART_HUB_HEADINGS } from "@/lib/editorial/art-hub.vm";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import {
  MarketingHorizontalRail,
  type MarketingMixedRailSlot,
  marketingMixedRailSlots,
  marketingRowLayout,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";

/*
 * The rail always rests on whole cards, so no title is ever cut at its edge. On desktop a tall,
 * a wide and a pair slot share one view exactly (24/44/32% of it, Figma `983:27670`), and the
 * rail snaps a view at a time; below that, slots are one (phones) or two (tablets) to a view.
 */
/** A tall, a wide and a pair slot: the fewest stories that fill one view of the rail. */
const MIXED_RAIL_MIN_ITEMS = 4;

const SLOT_BASE = "shrink-0 snap-start w-full sm:w-[calc((100%-1.5rem)/2)]";

const SLOT_CLASS: Record<MarketingMixedRailSlot["kind"], string> = {
  tall: "lg:w-[calc((100%-3rem)*0.24)]",
  wide: "lg:w-[calc((100%-3rem)*0.44)]",
  pair: "flex flex-col gap-6 lg:w-[calc((100%-3rem)*0.32)]",
};

const SLOT_SIZES: Record<MarketingMixedRailSlot["kind"], string> = {
  tall: "(min-width: 64rem) 24vw, (min-width: 40rem) 50vw, 100vw",
  wide: "(min-width: 64rem) 44vw, (min-width: 40rem) 50vw, 100vw",
  pair: "(min-width: 64rem) 16vw, (min-width: 40rem) 25vw, 50vw",
};

function MixedRail({ cards }: { cards: readonly EditorialCardVm[] }) {
  return (
    <MarketingHorizontalRail
      id="art-hub-stories-rail"
      ariaLabel={ART_HUB_HEADINGS.stories}
      forwardAriaLabel="More stories"
      backAriaLabel="Previous stories"
      controls="arrows-progress"
      controlsPlacement="below"
      edgeFade={false}
      scrollerAs="ul"
      scrollerClassName="art-focus-ring flex snap-x snap-mandatory items-start gap-6 overflow-x-auto pb-2 [scrollbar-width:none]"
    >
      {marketingMixedRailSlots(cards.length).map((slot, index) => (
        <li
          key={slot.items.map((item) => cards[item]?.key).join("+")}
          className={cn(
            SLOT_BASE,
            SLOT_CLASS[slot.kind],
            // On desktop the rail snaps to the start of each view of three slots.
            index % 3 !== 0 && "lg:snap-align-none",
          )}
          data-slot={slot.kind}
        >
          {slot.items.map((index) => {
            const card = cards[index];
            if (!card) return null;
            return (
              <ArtEditorialCard
                key={card.key}
                card={card}
                aspect={slot.kind === "wide" ? "landscape" : "portrait"}
                layout={slot.kind === "pair" ? "row" : "stacked"}
                sizes={SLOT_SIZES[slot.kind]}
              />
            );
          })}
        </li>
      ))}
    </MarketingHorizontalRail>
  );
}

const ROW_CLASS = {
  feature: "grid grid-cols-1",
  pair: "grid gap-x-6 gap-y-10 sm:grid-cols-2",
  grid: "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3",
} as const;

/**
 * "Ways of seeing": one story is a wide split card, two sit side by side, three fill a row, and
 * four or more (a full view of tall, wide and pair) run as the mixed-size rail. Titles wrap;
 * nothing is cut with an ellipsis.
 */
export function ArtHubStories({ cards }: { cards: readonly EditorialCardVm[] }) {
  const layout = marketingRowLayout(cards.length);
  if (layout === null) return null;
  const rail = cards.length >= MIXED_RAIL_MIN_ITEMS;
  return (
    <section aria-labelledby="art-hub-stories-title" className="flex flex-col gap-6">
      <ArtSectionHeader
        headingId="art-hub-stories-title"
        title={ART_HUB_HEADINGS.stories}
        subtitle={ART_HUB_HEADINGS.storiesSubtitle}
        viewAllHref="/stories"
        viewAllSrLabel="stories"
      />
      {rail ? (
        <MixedRail cards={cards} />
      ) : (
        <ul aria-label={ART_HUB_HEADINGS.stories} className={ROW_CLASS[layout]}>
          {cards.map((card) => (
            <li key={card.key}>
              <ArtEditorialCard card={card} layout={layout === "feature" ? "split" : "stacked"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
