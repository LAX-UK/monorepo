import type * as React from "react";
import { LaxIllustration, type LaxIllustrationName } from "../components/ui/lax-illustration.js";
import { cn } from "../lib/utils.js";

export type EmptyStateProps = {
  /**
   * The drawing from the shared LAX set, one per page: easel (start something), frame (nothing
   * on the wall), gavel (bids), parcel (purchases), ledger (money), plinth (a quiet list),
   * search (no results), lock (no access), ticket (not found) or askew (something went wrong).
   * The error variant always shows askew.
   */
  illustration: LaxIllustrationName;
  title: string;
  /** A short label above the title, in the copy column ("Not found", "Catalogue unavailable"). */
  eyebrow?: React.ReactNode;
  /** A sentence that says what and why, then what to do. */
  description: React.ReactNode;
  /** One action when the person has one: the primary first, then at most one more. */
  actions?: React.ReactNode;
  /** A control that belongs to the state itself, such as a search field, between the sentence and the actions. */
  control?: React.ReactNode;
  /** Quiet extra routes under the actions ("While you wait"), set apart by a hairline. */
  whileYouWait?: React.ReactNode;
  /**
   * Replaces the drawing and the paper plate, for a plate that is not a drawing (the hatched
   * placeholder of a lot that does not exist). It is decorative, so it is hidden from assistive tech.
   */
  plate?: React.ReactNode;
  /**
   * `inline` sits inside a list's own card; `page` is the larger 5/7 page layout, with the page's
   * h1 unless `headingLevel` says the page already owns its h1.
   */
  layout?: "inline" | "page";
  /** `compact` for a narrow panel or a list row: a smaller plate and tighter padding. */
  size?: "default" | "compact";
  /** `error` is a calm "something went wrong": the askew drawing, announced to assistive tech. */
  variant?: "empty" | "error";
  /**
   * h1 when the state is the whole page, h2 when it replaces a section's content, h3 inside a
   * section, `p` when the page already has its headings and the state is a quiet notice. Defaults
   * to h1 for the page layout and h2 otherwise; a page-layout state under a page that already has
   * its own h1 (a basket, a checkout step) passes h2 so the page keeps one h1.
   */
  headingLevel?: "h1" | "h2" | "h3" | "p";
  className?: string;
};

/**
 * The empty state of the client workspace: the drawing on a warm-paper plate, a 20/28 title, a
 * sentence at reading line height and the action. Inline, it sits beside the text once the space
 * it sits in is 672px wide and stacks below that. As a page (`layout="page"`) it is a 5/7 grid
 * with a 4:3 plate, for not found and route errors; it carries the page's h1 unless told otherwise.
 *
 * The drawing is in the foreground colour unless the product sets `--lax-plate-ink` (Shop and
 * lax.art set it to their accent, `--color-product-accent`; Bid sets nothing).
 */
export function EmptyState({
  illustration,
  title,
  eyebrow,
  description,
  actions,
  control,
  whileYouWait,
  plate,
  layout = "inline",
  size = "default",
  variant = "empty",
  headingLevel,
  className,
}: EmptyStateProps) {
  const isPage = layout === "page";
  const compact = size === "compact" && !isPage;
  const Heading = headingLevel ?? (isPage ? "h1" : "h2");
  const drawing = variant === "error" ? "askew" : illustration;

  return (
    <div
      data-empty-state={drawing}
      data-layout={layout}
      role={variant === "error" ? "alert" : undefined}
      className={cn("@container", className)}
    >
      <div
        className={cn(
          "grid grid-cols-1 items-center text-left",
          isPage && "gap-8 px-5 py-10 @3xl:grid-cols-12 @3xl:gap-12 @3xl:px-10 @3xl:py-20",
          compact && "gap-4 px-4 py-4 @xl:grid-cols-[auto_minmax(0,1fr)] @xl:gap-6",
          !isPage &&
            !compact &&
            "gap-6 px-5 py-6 @2xl:grid-cols-[auto_minmax(0,1fr)] @2xl:gap-10 @2xl:p-10",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "relative grid w-full place-items-center overflow-hidden rounded-lax-menu text-lax-plate-ink",
            !plate && "bg-lax-paper",
            isPage && "aspect-[4/3] @3xl:col-span-5",
            compact && "h-24 @xl:w-32",
            !isPage && !compact && "h-40 @2xl:h-42 @2xl:w-56",
          )}
        >
          {plate ?? (
            <LaxIllustration
              name={drawing}
              className={cn(
                "text-current",
                isPage && "w-44 @3xl:w-56",
                compact && "w-20",
                !isPage && !compact && "w-36 @2xl:w-40",
              )}
            />
          )}
        </div>
        <div className={cn("min-w-0", isPage && "@3xl:col-span-7")}>
          {eyebrow && <p className="mb-2 text-lax-13 text-lax-muted">{eyebrow}</p>}
          <Heading
            className={cn(
              "font-lax-display font-semibold text-balance text-lax-fg",
              isPage && "text-lax-28",
              compact && "text-lax-16",
              !isPage && !compact && "text-lax-20",
            )}
          >
            {title}
          </Heading>
          <p
            className={cn(
              "mt-2 max-w-[52ch] text-pretty text-lax-muted",
              compact ? "text-lax-13 leading-5" : "text-lax-14 leading-6",
            )}
          >
            {description}
          </p>
          {control ? <div className="mt-6 max-w-md">{control}</div> : null}
          {actions ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 @max-2xl:[&>*]:flex-1",
                compact ? "mt-4" : control ? "mt-4" : "mt-6",
              )}
            >
              {actions}
            </div>
          ) : null}
          {whileYouWait ? (
            <div className="mt-8 border-t border-lax-line-subtle pt-5 text-lax-14 text-lax-muted">
              {whileYouWait}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
