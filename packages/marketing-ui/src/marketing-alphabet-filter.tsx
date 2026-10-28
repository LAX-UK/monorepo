import { cn } from "@auction/ui";
import Link from "next/link";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Letter key: `a`–`z`, `#` for names starting with a digit, `other` for anything else. */
export type MarketingAlphabetLetterCount = { letter: string; count: number };

export type MarketingAlphabetFilterProps = {
  /** Directory path, e.g. `/artists`. Ignored when `hrefFor` is given. */
  basePath: string;
  /** Active letter (any case), `#`, `other`, or null for “All”. */
  active: string | null | undefined;
  /** Builds the link for a letter (lower case, `#`, `other`) or null for “All”. */
  hrefFor?: (letter: string | null) => string;
  /** When given, letters with no names are shown but not linked. */
  counts?: readonly MarketingAlphabetLetterCount[] | undefined;
  /** Adds “#” (digits) and “Other” buckets after Z. */
  includeOtherBuckets?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function marketingAlphabetHref(basePath: string, letter: string | null): string {
  return letter ? `${basePath}?letter=${letter.toLowerCase()}` : basePath;
}

const ITEM =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 font-body text-sm transition-colors motion-reduce:transition-none outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

type Item = { key: string; label: string; letter: string | null; spoken?: string };

/** “All” + A–Z first-letter filter as crawlable links; scrolls sideways on phones. */
export function MarketingAlphabetFilter({
  basePath,
  active,
  hrefFor,
  counts,
  includeOtherBuckets = false,
  ariaLabel = "Filter by first letter",
  className,
}: MarketingAlphabetFilterProps) {
  const current = active?.trim().toLowerCase() || null;
  const href = hrefFor ?? ((letter: string | null) => marketingAlphabetHref(basePath, letter));
  const countFor = (letter: string) => counts?.find((c) => c.letter === letter)?.count;
  const items: Item[] = [
    { key: "all", label: "All", letter: null },
    ...LETTERS.map((L) => ({ key: L, label: L, letter: L.toLowerCase() })),
    ...(includeOtherBuckets
      ? [
          { key: "digits", label: "#", letter: "#", spoken: "Names starting with a number" },
          { key: "other", label: "Other", letter: "other", spoken: "Other names" },
        ]
      : []),
  ];

  return (
    <nav aria-label={ariaLabel} className={cn("-mx-1 overflow-x-auto", className)}>
      <ul className="flex min-w-[max-content] gap-0.5 px-1 lg:min-w-0 lg:flex-wrap">
        {items.map((item) => {
          const isActive =
            item.letter === null
              ? current === null || current === "all"
              : item.letter === "#"
                ? current === "#" || /^[0-9]$/.test(current ?? "")
                : item.letter === current;
          const count = item.letter ? countFor(item.letter) : undefined;
          const empty = counts !== undefined && item.letter !== null && !count && !isActive;
          const spoken = item.spoken ?? item.label;
          if (empty) {
            return (
              <li key={item.key}>
                <span
                  aria-disabled="true"
                  aria-label={`${spoken}, no names`}
                  className={cn(ITEM, "cursor-default text-on-surface-variant/40")}
                >
                  {item.label}
                </span>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link
                href={href(item.letter)}
                aria-current={isActive ? "page" : undefined}
                {...(item.spoken ? { "aria-label": item.spoken } : {})}
                className={cn(
                  ITEM,
                  isActive
                    ? "bg-primary font-medium text-on-primary"
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
