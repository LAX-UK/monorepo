import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import { MarketingCardMedia, MarketingCardReveal, MarketingCardShell } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

type ArtEditorialCardProps = {
  card: EditorialCardVm;
  headingLevel?: "h2" | "h3";
  aspect?: "landscape" | "portrait";
  priority?: boolean;
};

/** Exhibition / story / placement tile: media, kicker, headline, meta line. */
export function ArtEditorialCard({
  card,
  headingLevel: Heading = "h3",
  aspect = "landscape",
  priority = false,
}: ArtEditorialCardProps) {
  return (
    <MarketingCardShell
      interactive={false}
      className="group h-full rounded-none bg-transparent"
      data-testid="art-editorial-card"
    >
      <ArtEditorialLink
        href={card.href}
        className="art-focus-ring flex h-full flex-col gap-3 rounded-sm"
      >
        <div aria-hidden="true">
          <MarketingCardMedia
            className={cn(
              "bg-surface-container",
              aspect === "portrait" ? "aspect-[4/5]" : "aspect-[4/3]",
            )}
          >
            <ArtMediaImage
              src={card.imageUrl}
              alt=""
              label={card.kicker ?? "LAX Art"}
              sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw"
              priority={priority}
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          </MarketingCardMedia>
        </div>
        <div className="flex flex-col gap-1">
          {card.kicker ? (
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface-variant">
              {card.kicker}
            </p>
          ) : null}
          <Heading className="font-headline text-lg font-semibold leading-snug text-on-surface group-hover:underline">
            {card.headline}
          </Heading>
          {card.meta ? (
            <p className="line-clamp-2 text-sm text-on-surface-variant">{card.meta}</p>
          ) : null}
        </div>
      </ArtEditorialLink>
    </MarketingCardShell>
  );
}

export function ArtEditorialCardGrid({
  cards,
  ariaLabel,
  priorityCount = 0,
  aspect,
}: {
  cards: readonly EditorialCardVm[];
  ariaLabel: string;
  priorityCount?: number;
  aspect?: "landscape" | "portrait";
}) {
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-label={ariaLabel}>
      {cards.map((card, index) => (
        <li key={card.key}>
          <MarketingCardReveal index={index}>
            <ArtEditorialCard
              card={card}
              priority={index < priorityCount}
              {...(aspect ? { aspect } : {})}
            />
          </MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
