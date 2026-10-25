import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { MarketingArrowUpRightIcon } from "./marketing-icons.js";

export type MarketingArtistCrossLink = {
  /** Stable key, e.g. "shop" or "art". */
  id: string;
  /** Link text, e.g. "Editions in LAX Shop". */
  label: string;
  /** Optional second line, e.g. "Limited editions and prints". */
  description?: string;
  /** Absolute URL on another LAX product. */
  href: string;
};

export type MarketingArtistCrossLinksProps = {
  links: readonly MarketingArtistCrossLink[];
  /** Accessible name of the list; there is no visible heading. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Links to the same artist in the other LAX products. Callers pass only links that have
 * content behind them; with none, nothing renders.
 */
export function MarketingArtistCrossLinks({
  links,
  ariaLabel = "This artist elsewhere at LAX",
  className,
}: MarketingArtistCrossLinksProps) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={ariaLabel} className={className} data-testid="marketing-artist-cross-links">
      <ul className={cn("grid gap-2", links.length > 1 && "sm:grid-cols-2")}>
        {links.map((link) => (
          <li key={link.id} className="min-w-0">
            <a
              href={link.href}
              rel="noopener"
              className={cn(
                "group flex min-h-12 items-center justify-between gap-3 rounded-md border border-border-hairline bg-surface px-4 py-3 text-on-surface transition-colors hover:border-on-surface/40 hover:bg-surface-container-low motion-reduce:transition-none",
                FOCUS_RING,
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-body text-sm font-medium leading-5">{link.label}</span>
                {link.description ? (
                  <span className="font-body text-xs leading-5 text-on-surface-variant">
                    {link.description}
                  </span>
                ) : null}
              </span>
              <MarketingArrowUpRightIcon className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
