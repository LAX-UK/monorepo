import type { ArtHomeEcosystemCardVm } from "@/lib/home/art-home-ecosystem.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

/**
 * Cream band with the LAX.bid and LAX.shop cards (Figma home `299:4535`). Figma's illustrations are
 * CMS content with no placement slot yet, so the cards are text-only on the feature surface.
 */
export function ArtHomeEcosystemBand({ cards }: { cards: readonly ArtHomeEcosystemCardVm[] }) {
  return (
    <section
      aria-label="Across LAX"
      className="bg-surface-feature py-16 text-on-surface-feature md:py-24"
      data-testid="art-home-ecosystem"
    >
      <ul className={cn(MARKETING_PAGE_SHELL, "grid gap-12 md:grid-cols-2 md:gap-10")}>
        {cards.map((card) => (
          <li key={card.id} className="flex flex-col gap-4">
            <p className="font-label text-xs font-medium uppercase tracking-[var(--text-label-caps-tracking)]">
              {card.eyebrow}
            </p>
            <h2 className="font-headline text-[length:var(--text-display-md)] font-normal leading-tight">
              {card.title}
            </h2>
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
