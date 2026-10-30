import type * as React from "react";
import { Children } from "react";
import { cn } from "../../lib/utils.js";

export type RecordListProps = {
  /** Names the list for assistive technology: "Your consignments". */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * The card that holds record rows: one hairline frame, a divider between rows. It is a size
 * container: a narrow list (a phone, a side column) stacks each row, and from 42rem the row runs
 * on one line, whatever the window width.
 */
export function RecordList({ className, children, ...aria }: RecordListProps) {
  return (
    <ul
      {...aria}
      className={cn(
        "@container divide-y divide-border-hairline overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest",
        className,
      )}
    >
      {children}
    </ul>
  );
}

type LinkComponent = React.ElementType<{
  href: string;
  className?: string;
  children?: React.ReactNode;
  "data-record-link"?: boolean;
}>;

export type RecordRowProps = {
  /** A thumbnail (`RecordRowMedia`) or initials. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Opens the record. The title becomes a link that covers the whole row. */
  href?: string;
  /** The link to render, for example the framework's client-side link. Defaults to `<a>`. */
  linkAs?: LinkComponent;
  /** One line of facts, shown with "·" between them. Empty entries are dropped. */
  meta?: readonly React.ReactNode[];
  /** A status badge. */
  status?: React.ReactNode;
  /** A figure, such as an amount; right-aligned with tabular digits. */
  value?: React.ReactNode;
  /**
   * Several labelled figures ("£6,800 current bid", "£6,200 your maximum"), right-aligned in a
   * row of cells before the status. A narrow list shows the first one beside the status, on one
   * line ("£6,800 current bid"); the record holds the rest. Use `value` for a single unlabelled
   * figure.
   */
  figures?: readonly RecordFigure[];
  /**
   * Line the row up with the other rows of its list: on a wide list the status and the action
   * keep their width even when this row has none (pass `action={null}` to keep the action
   * column on a row without one), so figures and badges form columns. A narrow
   * list keeps such a row to its title, facts, status and lead figure: the row opens the record,
   * where the step is.
   */
  aligned?: boolean;
  /** At most one inline action. Anything else goes in `menu`. */
  action?: React.ReactNode;
  /** The persistent "…" menu. */
  menu?: React.ReactNode;
  /** Content under the row that belongs to it, such as a progress line. */
  detail?: React.ReactNode;
  "aria-label"?: string;
  className?: string;
};

/** One labelled figure in a row: the value, then what it is. */
export type RecordFigure = {
  /** Keys the cell; the label is used when this is left out. */
  id?: string;
  value: React.ReactNode;
  label: string;
  /**
   * A narrow list reads the label first ("choose by 12 Nov"), as a date reads, instead of after
   * the value ("£6,800 current bid"). A wide list keeps the value above its label either way.
   */
  labelFirst?: boolean;
  /**
   * The record has no such figure yet, and `value` says so in words ("Estimate after review"):
   * drawn muted and allowed to wrap, with the label kept for readers only, so a missing figure
   * never reads as a dash under a label.
   */
  pending?: boolean;
};

/**
 * A row's figures as a description list. Wide, each value sits above its label in a cell of
 * fixed width, so the columns of a list line up from row to row; narrow, only the first shows,
 * as "value label" on one line.
 */
function RecordFigures({ figures }: { figures: readonly RecordFigure[] }) {
  return (
    <dl data-record-figures className="flex min-w-0 items-baseline gap-6 @2xl:shrink-0">
      {figures.map((figure, index) => (
        <div
          key={figure.id ?? figure.label}
          className={cn(
            "min-w-0 items-baseline gap-1",
            "@2xl:w-28 @2xl:flex-col @2xl:items-end @2xl:gap-0 @2xl:text-right",
            index === 0 ? "flex" : "hidden @2xl:flex",
          )}
        >
          <dt
            // Joined, not merged: the type step and the colour are both `text-` classes.
            className={
              figure.pending
                ? "sr-only"
                : `truncate font-body text-label-3 leading-5 text-on-surface-variant ${
                    figure.labelFirst ? "order-1 @2xl:order-2" : "order-2"
                  }`
            }
          >
            {figure.label}
          </dt>
          <dd
            className={
              figure.pending
                ? "font-body text-label-3 leading-5 text-on-surface-variant"
                : `truncate font-body text-sm leading-5.5 font-medium tabular-nums text-on-surface ${
                    figure.labelFirst ? "order-2 @2xl:order-1" : "order-1"
                  }`
            }
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function isShown(node: React.ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/**
 * The facts, with a dot between them. When the line wraps, each line starts with a fact, not a
 * dot: every fact carries its dot in front, and the line is shifted left by one dot's width and
 * clipped, so the dot that would open a line falls outside it. The dot is silent to readers.
 */
function MetaLine({ items }: { items: readonly React.ReactNode[] }) {
  const shown = items.filter(isShown);
  if (shown.length === 0) return null;
  return (
    <p
      data-record-meta
      className="mt-0.5 overflow-hidden font-body text-label-3 leading-5 text-on-surface-variant"
    >
      <span className="-ml-4 flex min-w-0 flex-wrap">
        {/* Facts are positional: the caller's order is the reading order. */}
        {Children.map(shown, (item) => (
          <span
            data-record-fact
            className="flex min-w-0 before:w-4 before:shrink-0 before:text-center before:content-['·'_/_'']"
          >
            <span className="min-w-0 truncate">{item}</span>
          </span>
        ))}
      </span>
    </p>
  );
}

/**
 * One record in a list: thumbnail or initials, title, one line of facts, a status, a figure, one
 * action and a "…" menu. When the row has an `href` the whole row opens the record and its own
 * controls stay clickable above that link. In a narrow list the facts, status and action move
 * under the title and long text wraps or truncates, so nothing runs past the card edge.
 */
export function RecordRow({
  leading,
  title,
  href,
  linkAs: Link = "a",
  meta = [],
  status,
  value,
  figures = [],
  aligned = false,
  action,
  menu,
  detail,
  className,
  ...aria
}: RecordRowProps) {
  const hasFoot =
    aligned || isShown(status) || isShown(value) || isShown(action) || figures.length > 0;
  return (
    <li
      {...aria}
      data-record-row
      className={cn(
        "relative flex min-h-14 flex-col gap-3 px-4 py-3 @2xl:px-5",
        href &&
          "motion-safe:transition-colors motion-safe:duration-150 hover:bg-surface-container-low has-[[data-record-link]:focus-visible]:outline-2 has-[[data-record-link]:focus-visible]:-outline-offset-2 has-[[data-record-link]:focus-visible]:outline-ring has-[[data-record-link]:focus-visible]:outline-solid",
        className,
      )}
    >
      <div className="flex min-w-0 gap-3 @2xl:gap-4">
        {isShown(leading) ? (
          <span className="shrink-0 self-start @2xl:self-center">{leading}</span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-2",
              "@2xl:flex-row @2xl:items-center @2xl:gap-4",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm leading-5.5 font-medium text-on-surface">
                {href ? (
                  <Link
                    href={href}
                    data-record-link
                    className="after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </p>
              <MetaLine items={meta} />
            </div>
            {hasFoot ? (
              <div
                data-record-foot
                className={cn(
                  "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2",
                  "@2xl:shrink-0 @2xl:flex-nowrap @2xl:justify-end",
                )}
              >
                {figures.length > 0 ? <RecordFigures figures={figures} /> : null}
                {isShown(status) || aligned ? (
                  <span
                    data-record-status
                    className={cn(
                      "shrink-0",
                      // Narrow, the status leads the line and the figure follows it.
                      figures.length > 0 && "-order-1 @2xl:order-none",
                      aligned && "@2xl:flex @2xl:w-40 @2xl:justify-end",
                      !isShown(status) && "hidden",
                    )}
                  >
                    {status}
                  </span>
                ) : null}
                {isShown(value) ? (
                  <span className="shrink-0 font-body text-sm leading-5.5 font-medium tabular-nums text-on-surface">
                    {value}
                  </span>
                ) : null}
                {isShown(action) || (aligned && action !== undefined) ? (
                  <span
                    data-record-action
                    className={cn(
                      "relative z-10 ml-auto shrink-0 @2xl:ml-0",
                      aligned && "hidden @2xl:flex @2xl:w-36 @2xl:justify-end",
                      !isShown(action) && "hidden",
                    )}
                  >
                    {action}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {aligned && !isShown(menu) ? (
          <span aria-hidden className="hidden size-10 shrink-0 @2xl:block" />
        ) : null}
        {isShown(menu) ? (
          <span className="relative z-10 -my-1 -mr-2 shrink-0 self-start @2xl:my-0 @2xl:self-center">
            {menu}
          </span>
        ) : null}
      </div>
      {isShown(detail) ? (
        // Full width in a narrow list, so a progress line has room; under the title when wide.
        <div
          data-record-detail
          className={cn("relative z-10 min-w-0", isShown(leading) && "@2xl:pl-16")}
        >
          {detail}
        </div>
      ) : null}
    </li>
  );
}

export type RecordRowMediaProps = {
  /** An image element sized to fill, or a placeholder. */
  children: React.ReactNode;
  className?: string;
};

/**
 * The 48px square thumbnail at the start of a row, with a hairline inside its edge so a pale or
 * dark artwork keeps its shape on either theme.
 */
export function RecordRowMedia({ children, className }: RecordRowMediaProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block size-12 overflow-hidden rounded-md bg-surface-container-high",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:ring-1 after:ring-border-hairline after:ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}
