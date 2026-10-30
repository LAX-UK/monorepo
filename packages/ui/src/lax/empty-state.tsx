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
 * sentence at reading line height and the action. Beside each other from 768px; stacked on a
 * phone, with the plate across the full width. It sits inside the list's own card.
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
    <div
      data-empty-state={illustration}
      className={cn(
        "grid grid-cols-1 items-center gap-6 px-5 py-6 text-left",
        "md:grid-cols-[auto_minmax(0,1fr)] md:gap-10 md:p-10",
        className,
      )}
    >
      <div
        aria-hidden
        className="grid h-40 w-full place-items-center rounded-lax-menu bg-lax-paper text-lax-fg md:h-42 md:w-56"
      >
        <LaxIllustration name={illustration} size="panel" className="w-36 text-current md:w-40" />
      </div>
      <div className="min-w-0">
        <Heading className="font-lax-display text-lax-20 font-semibold text-balance text-lax-fg">
          {title}
        </Heading>
        <p className="mt-2 max-w-[52ch] text-lax-14 leading-6 text-pretty text-lax-muted">
          {description}
        </p>
        {actions ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 max-md:[&>*]:flex-1">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
