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

/*
 * Mixed rail widths (Figma `983:27670`): a tall 312px portrait, a 576px landscape and a 400px
 * column of two compact cards, whose images all stand about 430px tall on desktop.
 */
const SLOT_CLASS: Record<MarketingMixedRailSlot["kind"], string> = {
  tall: "w-[min(78vw,19.5rem)]",
  wide: "w-[min(85vw,36rem)]",
  pair: "flex w-[min(85vw,25rem)] flex-col gap-6",
};

const SLOT_SIZES: Record<MarketingMixedRailSlot["kind"], string> = {
  tall: "(min-width: 40rem) 20rem, 78vw",
  wide: "(min-width: 40rem) 36rem, 85vw",
  pair: "(min-width: 40rem) 12.5rem, 42vw",
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
      scrollerAs="ul"
      scrollerClassName="art-focus-ring flex snap-x snap-mandatory items-start gap-6 overflow-x-auto pb-2 [scrollbar-width:none]"
    >
      {marketingMixedRailSlots(cards.length).map((slot) => (
        <li
          key={slot.items.map((index) => cards[index]?.key).join("+")}
          className={`shrink-0 snap-start ${SLOT_CLASS[slot.kind]}`}
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

/**
 * "Ways of seeing": one story is a wide split card, two sit side by side, and three or more run
 * as the mixed-size rail. Titles wrap; nothing is cut with an ellipsis.
 */
export function ArtHubStories({ cards }: { cards: readonly EditorialCardVm[] }) {
  const layout = marketingRowLayout(cards.length);
  if (layout === null) return null;
  return (
    <section aria-labelledby="art-hub-stories-title" className="flex flex-col gap-6">
      <ArtSectionHeader
        headingId="art-hub-stories-title"
        title={ART_HUB_HEADINGS.stories}
        subtitle={ART_HUB_HEADINGS.storiesSubtitle}
        viewAllHref="/stories"
        viewAllSrLabel="stories"
      />
      {layout === "grid" ? (
        <MixedRail cards={cards} />
      ) : (
        <ul
          aria-label={ART_HUB_HEADINGS.stories}
          className={
            layout === "pair" ? "grid gap-x-6 gap-y-10 sm:grid-cols-2" : "grid grid-cols-1"
          }
        >
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
