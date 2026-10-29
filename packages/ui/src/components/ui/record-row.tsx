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
  /** A status badge. */
  status?: React.ReactNode;
  /** A figure, such as an amount; right-aligned with tabular digits. */
  value?: React.ReactNode;
  /** At most one inline action. Anything else goes in `menu`. */
  action?: React.ReactNode;
  /** The persistent "…" menu. */
  menu?: React.ReactNode;
  /** Content under the row that belongs to it, such as a progress line. */
  detail?: React.ReactNode;
  "aria-label"?: string;
  className?: string;
};

function isShown(node: React.ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

function MetaLine({ items }: { items: readonly React.ReactNode[] }) {
  const shown = items.filter(isShown);
  if (shown.length === 0) return null;
  return (
    <p
      data-record-meta
      className="mt-0.5 flex min-w-0 flex-wrap gap-x-1.5 font-body text-label-3 leading-5 text-on-surface-variant"
    >
      {shown.map((item, index) => (
        // Facts are positional: the caller's order is the reading order.
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered list of facts
        <span key={index} className="flex min-w-0 gap-x-1.5">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span className="min-w-0 truncate">{item}</span>
        </span>
      ))}
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
  action,
  menu,
  detail,
  className,
  ...aria
}: RecordRowProps) {
  const hasFoot = isShown(status) || isShown(value) || isShown(action);
  return (
    <li
      {...aria}
      data-record-row
      className={cn(
        "relative flex min-h-14 gap-3 px-4 py-3",
        "@2xl:gap-4 @2xl:px-5",
        href &&
          "motion-safe:transition-colors motion-safe:duration-150 hover:bg-surface-container-low has-[[data-record-link]:focus-visible]:outline-2 has-[[data-record-link]:focus-visible]:-outline-offset-2 has-[[data-record-link]:focus-visible]:outline-ring has-[[data-record-link]:focus-visible]:outline-solid",
        className,
      )}
    >
      {isShown(leading) ? (
        <span className={cn("shrink-0 self-start @2xl:self-center")}>{leading}</span>
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
              {isShown(status) ? <span className="shrink-0">{status}</span> : null}
              {isShown(value) ? (
                <span className="shrink-0 font-body text-sm leading-5.5 font-medium tabular-nums text-on-surface">
                  {value}
                </span>
              ) : null}
              {isShown(action) ? (
                <span className={cn("relative z-10 ml-auto shrink-0 @2xl:ml-0")}>{action}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {isShown(detail) ? <div className="relative z-10 min-w-0">{detail}</div> : null}
      </div>
      {isShown(menu) ? (
        <span
          className={cn(
            "relative z-10 -my-1 -mr-2 shrink-0 self-start",
            "@2xl:my-0 @2xl:self-center",
          )}
        >
          {menu}
        </span>
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
