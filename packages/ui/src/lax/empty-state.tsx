import type * as React from "react";
import { LaxIllustration, type LaxIllustrationName } from "../components/ui/lax-illustration.js";
import { cn } from "../lib/utils.js";

export type EmptyStateProps = {
  /**
   * The drawing from the shared LAX set, one per page: easel (start something), frame (nothing
   * on the wall), gavel (bids), parcel (purchases), ledger (money), plinth (a quiet list),
   * search (no results) or lock (no access).
   */
  illustration: LaxIllustrationName;
  title: string;
  /** A sentence that says what and why, then what to do. */
  description: React.ReactNode;
  /** One action when the person has one: the primary first, then at most one more. */
  actions?: React.ReactNode;
  /** h2 when the state replaces a page's content, h3 inside a section. */
  headingLevel?: "h2" | "h3";
  className?: string;
};

/**
 * The empty state of the client workspace: the drawing on a warm-paper plate, a 20/28 title, a
 * sentence at reading line height and the action. Beside each other once the space it sits in is
 * 672px wide; stacked below that, with the plate across the full width. It sits inside the list's
 * own card.
 */
export function EmptyState({
  illustration,
  title,
  description,
  actions,
  headingLevel = "h2",
  className,
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div data-empty-state={illustration} className={cn("@container", className)}>
      <div
        className={cn(
          "grid grid-cols-1 items-center gap-6 px-5 py-6 text-left",
          "@2xl:grid-cols-[auto_minmax(0,1fr)] @2xl:gap-10 @2xl:p-10",
        )}
      >
        <div
          aria-hidden
          className="grid h-40 w-full place-items-center rounded-lax-menu bg-lax-paper text-lax-fg @2xl:h-42 @2xl:w-56"
        >
          <LaxIllustration
            name={illustration}
            size="panel"
            className="w-36 text-current @2xl:w-40"
          />
        </div>
        <div className="min-w-0">
          <Heading className="font-lax-display text-lax-20 font-semibold text-balance text-lax-fg">
            {title}
          </Heading>
          <p className="mt-2 max-w-[52ch] text-lax-14 leading-6 text-pretty text-lax-muted">
            {description}
          </p>
          {actions ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 @max-2xl:[&>*]:flex-1">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
