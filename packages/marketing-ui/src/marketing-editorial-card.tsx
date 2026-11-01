import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";

const ASPECT_CLASS = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[8/11]",
  wide: "aspect-[21/10]",
} as const;

/**
 * `stacked` puts the text under the media. `split` puts them side by side from `md` (media 7, text
 * 5), for a card that is alone in its row and would otherwise be one very large image. `row` is a
 * compact card with media and text side by side at every width (half each), for two cards
 * stacked in one column of a mixed rail (Figma Art Hub stories, `983:27672`).
 */
const LAYOUT_CLASS = {
  stacked: { card: "flex h-full flex-col gap-4", text: "flex flex-col gap-4" },
  split: {
    card: "flex h-full flex-col gap-4 md:grid md:grid-cols-[7fr_5fr] md:items-center md:gap-12",
    text: "flex flex-col gap-4",
  },
  row: {
    card: "grid h-full grid-cols-2 items-start gap-4",
    text: "flex min-w-0 flex-col gap-2",
  },
} as const;

const TITLE_CLASS: Record<keyof typeof LAYOUT_CLASS, string> = {
  stacked: "text-lg leading-7 md:text-xl",
  split: "text-xl leading-7 md:text-[1.75rem] md:leading-tight",
  row: "text-base leading-6 md:text-lg md:leading-7",
};

type EditorialCardLinkProps = { href: string; className?: string; children: ReactNode };

export type MarketingEditorialCardProps = {
  /** Fills the media slot (`absolute inset-0 size-full`). */
  media: ReactNode;
  /**
   * `landscape` 4:3 for features and rails; `portrait` 8:11 for story grids (Figma `251:1312`);
   * `wide` 21:10 for a full-width lead (Figma `285:3008`, drawn about 1200×568).
   */
  aspect?: "landscape" | "portrait" | "wide";
  layout?: keyof typeof LAYOUT_CLASS;
  /** Uppercase parts divided by a rule, e.g. ["Exhibition", "London"] or ["Article", "16 Apr 2026"]. */
  kicker?: readonly string[];
  title: string;
  /** Secondary lines under the title (date range, time and place, standfirst). */
  details?: readonly ReactNode[];
  /** Beside the title, outside the link, so a nested control (heart) stays its own tab stop. */
  trailing?: ReactNode;
  /** Missing href renders the title as plain text. */
  href?: string | null;
  /** Products route CMS links through their own safe-link component; defaults to `next/link`. */
  linkAs?: ComponentType<EditorialCardLinkProps>;
  "data-testid"?: string;
};

/**
 * Exhibition, story and placement card with square corners (Figma `263:1922`, `251:1312`). The
 * title link stretches over the whole card so media and text share one tab stop.
 */
export function MarketingEditorialCard({
  media,
  aspect = "landscape",
  layout = "stacked",
  kicker = [],
  title,
  details = [],
  trailing,
  href,
  linkAs: LinkComponent = Link,
  "data-testid": testId,
}: MarketingEditorialCardProps) {
  return (
    <article
      className={cn("group relative", LAYOUT_CLASS[layout].card)}
      data-layout={layout}
      data-testid={testId}
    >
      <MarketingCardMedia className={cn("bg-surface-container", ASPECT_CLASS[aspect])}>
        {media}
      </MarketingCardMedia>
      <div className={LAYOUT_CLASS[layout].text}>
        <div className="flex flex-col gap-1">
          {kicker.length > 0 ? (
            <p className="flex flex-wrap items-center font-label text-xs leading-[1.125rem] text-on-surface-variant">
              {kicker.map((part, index) => (
                <span
                  key={part}
                  className={cn(
                    index > 0 && "pl-3",
                    index < kicker.length - 1 && "border-r border-current pr-3",
                  )}
                >
                  {part}
                </span>
              ))}
            </p>
          ) : null}
          <div className="flex items-start gap-4">
            <h3
              className={cn(
                "min-w-0 flex-1 font-headline font-medium text-on-surface",
                TITLE_CLASS[layout],
              )}
            >
              {href ? (
                <LinkComponent
                  href={href}
                  className={cn(
                    "rounded-sm underline-offset-4 after:absolute after:inset-0 group-hover:underline",
                    FOCUS_RING,
                  )}
                >
                  {title}
                </LinkComponent>
              ) : (
                title
              )}
            </h3>
            {trailing ? <div className="relative z-[1] -mt-2 shrink-0">{trailing}</div> : null}
          </div>
        </div>
        {details.length > 0 ? (
          <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
            {details.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: detail lines are positional.
              <p key={index} className="line-clamp-2">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
