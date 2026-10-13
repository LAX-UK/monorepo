import { cn } from "@auction/ui";
import Link from "next/link";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type MarketingAlphabetFilterProps = {
  /** Directory path, e.g. `/artists`. */
  basePath: string;
  /** Active letter (any case) or null for “All”. */
  active: string | null;
  ariaLabel?: string;
  className?: string;
};

export function marketingAlphabetHref(basePath: string, letter: string | null): string {
  return letter ? `${basePath}?letter=${letter.toLowerCase()}` : basePath;
}

const ITEM =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 font-label text-xs uppercase tracking-widest transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** “All” + A–Z first-letter filter rendered as crawlable links (scrolls horizontally on mobile). */
export function MarketingAlphabetFilter({
  basePath,
  active,
  ariaLabel = "Filter by first letter",
  className,
}: MarketingAlphabetFilterProps) {
  const current = active?.toUpperCase() ?? null;
  const items = [{ key: "all", label: "All", letter: null as string | null }].concat(
    LETTERS.map((letter) => ({ key: letter, label: letter, letter })),
  );
  return (
    <nav aria-label={ariaLabel} className={cn("-mx-1 overflow-x-auto", className)}>
      <ul className="flex min-w-max gap-0.5 px-1 lg:min-w-0 lg:flex-wrap">
        {items.map((item) => {
          const isActive = item.letter === current;
          return (
            <li key={item.key}>
              <Link
                href={marketingAlphabetHref(basePath, item.letter)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  ITEM,
                  isActive
                    ? "bg-on-surface text-surface"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
