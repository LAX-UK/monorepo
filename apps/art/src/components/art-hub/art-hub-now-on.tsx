import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtSectionHeader } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ART_HUB_HEADINGS } from "@/lib/editorial/art-hub.vm";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingHorizontalRail, MarketingOverlayCard } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

const RAIL_ID = "art-hub-now-on-rail";

/*
 * Peek carousel (Figma `992:14233`): each slide is 85% of the viewport up to 1220px, centred, so
 * the neighbours show at both edges. The padding centres the first and last slides.
 */
const SLIDE_CLASS = "w-[85vw] max-w-[76.25rem] shrink-0 snap-center";
const SCROLLER_CLASS =
  "art-focus-ring flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-[max(7.5vw,calc((100%-76.25rem)/2))] [scrollbar-width:none]";

function NowOnCard({
  card,
  aspect,
  priority,
}: {
  card: EditorialCardVm;
  aspect: "cinema" | "wide";
  priority: boolean;
}) {
  return (
    <MarketingOverlayCard
      data-testid="art-hub-now-on-card"
      aspect={aspect}
      href={card.href}
      linkAs={ArtEditorialLink}
      title={card.headline}
      kicker={[card.kicker, card.kickerDetail].filter((part): part is string => Boolean(part))}
      details={card.meta ? [card.meta] : []}
      media={
        <ArtMediaImage
          src={card.imageUrl}
          alt=""
          label={card.kicker ?? "Exhibition"}
          sizes={aspect === "wide" ? "(min-width: 90rem) 1360px, 100vw" : "85vw"}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
    />
  );
}

/**
 * "Happening now in the gallery": two or more shows run as the full-bleed peek carousel; a single
 * show is one wide feature within the page width, with no controls to suggest more.
 */
export function ArtHubNowOn({ cards }: { cards: readonly EditorialCardVm[] }) {
  const [only] = cards;
  if (!only) return null;
  const single = cards.length === 1;
  return (
    <section aria-labelledby="art-hub-now-on-title" className="flex flex-col gap-6">
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-6")}>
        <ArtSectionHeader
          headingId="art-hub-now-on-title"
          title={ART_HUB_HEADINGS.nowOn}
          subtitle={ART_HUB_HEADINGS.nowOnSubtitle}
          viewAllHref="/exhibitions"
          viewAllSrLabel="exhibitions"
        />
        {single ? <NowOnCard card={only} aspect="wide" priority={false} /> : null}
      </div>
      {single ? null : (
        <MarketingHorizontalRail
          id={RAIL_ID}
          ariaLabel={ART_HUB_HEADINGS.nowOn}
          forwardAriaLabel="Next exhibition"
          backAriaLabel="Previous exhibition"
          controls="arrows-progress"
          controlsPlacement="below"
          edgeFade={false}
          scrollerAs="ul"
          scrollerClassName={SCROLLER_CLASS}
        >
          {cards.map((card) => (
            <li key={card.key} className={SLIDE_CLASS}>
              <NowOnCard card={card} aspect="cinema" priority={false} />
            </li>
          ))}
        </MarketingHorizontalRail>
      )}
    </section>
  );
}
