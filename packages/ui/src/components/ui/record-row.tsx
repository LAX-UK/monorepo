import type * as React from "react";
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
  /**
   * One more fact for a narrow row only, for a fact a wide row says elsewhere (in a figure's
   * `note`), so it is never said twice.
   */
  metaNarrow?: React.ReactNode;
  /**
   * The position in `meta` of the one fact that gives way to a long value. When set, a wide row
   * keeps its facts on one line, truncating that fact, in tabular figures; a narrow row wraps
   * them as usual. Without it, facts wrap at every width.
   */
  metaShrink?: number;
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
   * How a narrow list shows `figures`: only the first beside the status (`"lead"`, the default),
   * or every one (`"all"`), on one line in the wide row's order with "·" between them, each
   * "value label" kept together when the line wraps, and the status on the line under them.
   */
  figuresNarrow?: "lead" | "all";
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
  /**
   * The record waits on the reader and `action` is the step that clears it (outbid, to pay,
   * needs changes, choose what happens next). A narrow list shows that one action full width
   * under the row's facts instead of leaving it in the "…" menu; a wide list keeps it in its
   * column as for any aligned row.
   */
  needsYou?: boolean;
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
  /**
   * A line in the label's place, one line under the value ("20:00 in Cairo"). The label stays
   * for readers only, so the cell keeps its height.
   */
  note?: React.ReactNode;
  /**
   * A wide row gives this cell room (9rem) for a note that names a day, while the page knows the
   * visitor's clock differs from London's (`html.tz-away`). Give it to every row's cell in the
   * column, so the columns of a list stay aligned.
   */
  roomyWhenAway?: boolean;
};

/**
 * A row's figures as a description list. Wide, each value sits above its label in a cell of
 * fixed width, so the columns of a list line up from row to row; narrow, only the first shows,
 * as "value label" on one line.
 */
function RecordFigures({
  figures,
  all = false,
}: {
  figures: readonly RecordFigure[];
  /** Narrow, show every figure on one line with "·" between them (`figuresNarrow="all"`). */
  all?: boolean;
}) {
  const list = (
    <dl
      data-record-figures
      className={cn(
        "flex min-w-0 items-baseline @2xl:shrink-0",
        // Each figure carries its dot in front, and the line is shifted left by one dot (and its
        // gap) and clipped, so a wrapped line starts with a figure, not a dot, as in the facts.
        all ? "-ml-5 flex-wrap @2xl:ml-0 @2xl:flex-nowrap @2xl:gap-6" : "gap-6",
      )}
    >
      {figures.map((figure, index) => (
        <div
          key={figure.id ?? figure.label}
          className={cn(
            "min-w-0 items-baseline gap-1",
            "@2xl:w-28 @2xl:flex-col @2xl:items-end @2xl:gap-0 @2xl:text-right",
            all
              ? "flex shrink-0 whitespace-nowrap before:w-4 before:shrink-0 before:text-center before:font-body before:text-label-3 before:text-on-surface-variant before:content-['·'_/_''] @2xl:shrink @2xl:whitespace-normal @2xl:before:content-none"
              : index === 0
                ? "flex"
                : "hidden @2xl:flex",
            figure.roomyWhenAway && "[html.tz-away_&]:@2xl:w-36",
          )}
        >
          <dt
            // Joined, not merged: the type step and the colour are both `text-` classes.
            className={
              figure.note
                ? "sr-only"
                : figure.pending
                  ? all
                    ? // Narrow, the label reads first, as a fact: "you receive: After payment".
                      "order-1 font-body text-label-3 leading-5 text-on-surface-variant after:content-[':'] @2xl:sr-only"
                    : "sr-only"
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
                ? all
                  ? // Narrow, said at the weight of the figure beside it; wide, muted in its cell.
                    "order-2 font-body text-sm leading-5.5 font-medium text-on-surface @2xl:text-label-3 @2xl:leading-5 @2xl:font-normal @2xl:text-on-surface-variant"
                  : "font-body text-label-3 leading-5 text-on-surface-variant"
                : `truncate font-body text-sm leading-5.5 font-medium tabular-nums text-on-surface ${
                    figure.labelFirst ? "order-2 @2xl:order-1" : "order-1"
                  }`
            }
          >
            {figure.value}
          </dd>
          {figure.note ? (
            <dd className="order-2 w-full min-w-0 truncate font-body text-label-3 leading-5 whitespace-nowrap text-on-surface-variant">
              {figure.note}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
  return all ? (
    <div className="min-w-0 basis-full overflow-hidden @2xl:basis-auto @2xl:overflow-visible">
      {list}
    </div>
  ) : (
    list
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
function MetaLine({
  items,
  shrink,
  narrowOnly,
}: {
  items: readonly React.ReactNode[];
  shrink?: number | undefined;
  narrowOnly?: React.ReactNode;
}) {
  const shown = items.flatMap((item, index) => (isShown(item) ? [{ item, index }] : []));
  if (isShown(narrowOnly)) shown.push({ item: narrowOnly, index: items.length });
  if (shown.length === 0) return null;
  const oneLine = shrink !== undefined;
  return (
    <p
      data-record-meta
      className={`mt-0.5 overflow-hidden font-body text-label-3 leading-5 text-on-surface-variant${
        oneLine ? " tabular-nums" : ""
      }`}
    >
      <span className={`-ml-4 flex min-w-0 flex-wrap${oneLine ? " @2xl:flex-nowrap" : ""}`}>
        {/* Facts are positional: the caller's order is the reading order. */}
        {shown.map(({ item, index }) => (
          <span
            key={index}
            data-record-fact
            className={`flex min-w-0 before:w-4 before:shrink-0 before:text-center before:content-['·'_/_'']${
              oneLine && index !== shrink ? " @2xl:shrink-0" : ""
            }${index === items.length && isShown(narrowOnly) ? " @2xl:hidden" : ""}`}
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
  metaShrink,
  metaNarrow,
  status,
  value,
  figures = [],
  figuresNarrow = "lead",
  aligned = false,
  action,
  needsYou = false,
  menu,
  detail,
  className,
  ...aria
}: RecordRowProps) {
  const stacksAction = needsYou && isShown(action);
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
                    // A block at least 24px tall (WCAG 2.5.8) without moving the line: the padding
                    // is taken back by the margin. The whole row stays the click area (after:).
                    className="-my-[3px] block truncate py-[3px] after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </p>
              <MetaLine items={meta} shrink={metaShrink} narrowOnly={metaNarrow} />
            </div>
            {hasFoot ? (
              <div
                data-record-foot
                className={cn(
                  "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2",
                  "@2xl:shrink-0 @2xl:flex-nowrap @2xl:justify-end",
                )}
              >
                {figures.length > 0 ? (
                  <RecordFigures figures={figures} all={figuresNarrow === "all"} />
                ) : null}
                {isShown(status) || aligned ? (
                  <span
                    data-record-status
                    className={cn(
                      "shrink-0",
                      // Narrow, the status leads the line and the figure follows it; with every
                      // figure shown, the figures take their own line and the status follows.
                      figures.length > 0 && figuresNarrow === "lead" && "-order-1 @2xl:order-none",
                      aligned && "@2xl:flex @2xl:w-32 @2xl:justify-start",
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
                    {...(stacksAction ? { "data-needs-you": "" } : {})}
                    className={cn(
                      "relative z-10",
                      stacksAction
                        ? // Narrow: its own full-width line under the facts. Wide: the aligned column.
                          "order-last basis-full [&>*]:w-full @2xl:order-none @2xl:flex @2xl:w-40 @2xl:basis-auto"
                        : cn(
                            "ml-auto shrink-0 @2xl:ml-0",
                            // The button fills the column, so every row's action has one width.
                            aligned && "hidden @2xl:flex @2xl:w-40 @2xl:[&>*]:w-full",
                          ),
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
