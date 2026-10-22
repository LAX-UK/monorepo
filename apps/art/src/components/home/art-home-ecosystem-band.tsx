import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtHomeEcosystemCardVm } from "@/lib/home/art-home-ecosystem.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

/**
 * Cream band with the LAX Bid and LAX Shop cards (Figma home `299:4535`). A card shows its
 * illustration only when the CMS promo placement supplies one.
 */
export function ArtHomeEcosystemBand({
  cards,
  heading,
}: {
  cards: readonly ArtHomeEcosystemCardVm[];
  /** Adds a section heading above the cards (Art Hub `980:26767`); card titles then drop to h3. */
  heading?: { title: string; subtitle?: string };
}) {
  const CardHeading = heading ? "h3" : "h2";
  return (
    <section
      aria-label={heading?.title ?? "Across LAX"}
      className="bg-surface-feature py-16 text-on-surface-feature md:py-24"
      data-testid="art-home-ecosystem"
    >
      {heading ? (
        <div className={cn(MARKETING_PAGE_SHELL, "mb-12 flex flex-col gap-2")}>
          <h2 className="font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2]">
            {heading.title}
          </h2>
          {heading.subtitle ? (
            <p className="max-w-[45rem] text-base text-on-surface-variant">{heading.subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <ul className={cn(MARKETING_PAGE_SHELL, "grid gap-12 md:grid-cols-2 md:gap-10")}>
        {cards.map((card) => (
          <li key={card.id} className="flex flex-col gap-4">
            {card.imageUrl ? (
              <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden">
                <ArtMediaImage
                  src={card.imageUrl}
                  alt=""
                  label={card.eyebrow}
                  sizes="(min-width: 48rem) 45vw, 100vw"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              </div>
            ) : null}
            <p className="font-label text-xs font-medium uppercase tracking-[var(--text-label-caps-tracking)]">
              {card.eyebrow}
            </p>
            <CardHeading className="font-headline text-[length:var(--text-display-md)] font-normal leading-tight">
              {card.title}
            </CardHeading>
            <p className="max-w-[41rem] text-base leading-relaxed text-on-surface-variant">
              {card.body}
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-2 min-h-11 w-fit border-current bg-transparent font-label text-on-surface-feature hover:bg-surface-container-low/40"
            >
              <a href={card.cta.href}>{card.cta.label}</a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
