"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import type { LinkComponent } from "@auction/ui/lax";
import { Cog, ImageOff } from "lucide-react";
import type * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { formatStaffDate, formatStaffDateTime, formatStaffMoney } from "../lib/format.js";
import { initialsOf } from "../lib/initials.js";

/*
 * The cells every staff list is made of, so the same value never looks two ways: the row's
 * identifying cell (a link, optionally with a muted second line), an empty value, a date with its
 * time on hover, and an amount.
 */

/** A link inside a table cell: inherits the text colour, underlines on hover, 24px to hit. */
export const staffCellLinkClass =
  "staff-focus inline-block max-w-full truncate rounded-staff-xs align-middle leading-6 underline-offset-2 decoration-staff-line-strong hover:underline";

/** One muted em dash for a value that is not there, read as "None" by screen readers. */
export function EmptyValue() {
  return (
    <span className="text-staff-subtle">
      <span aria-hidden>—</span>
      <span className="sr-only">None</span>
    </span>
  );
}

/** True for what a cell would render as nothing. */
export function isEmptyCellValue(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === false || value === "";
}

/**
 * A record's picture at row size: 32px, radius xs, with a hairline. A record with no picture yet
 * shows a dashed placeholder, so the column still lines up and the gap is visible.
 */
export function CellThumbnail({ src, label }: { src: string | null; label?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        className="size-8 shrink-0 rounded-staff-xs border border-staff-line bg-staff-sunken object-cover"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={label ?? "No picture yet"}
      className="flex size-8 shrink-0 items-center justify-center rounded-staff-xs border border-dashed border-staff-line-strong text-staff-subtle [&_svg]:size-3.5"
    >
      <ImageOff aria-hidden />
    </span>
  );
}

/**
 * The row's first cell: what the row is, as a real link (so cmd-click opens a new tab) in medium
 * weight, and an optional muted second line ("Lot 12 · Autumn sale"). Lists whose first cell
 * has a second line default to comfortable rows; keep the line to one short fact or two. With
 * `thumbnail`, the record's picture sits before the text (a placeholder when it has none).
 */
export function PrimaryCell({
  children,
  href,
  Link,
  secondary,
  external = false,
  thumbnail,
  unread,
}: {
  children: React.ReactNode;
  href?: string | null;
  Link?: LinkComponent;
  secondary?: React.ReactNode;
  /** Opens outside the tool, in a new tab. */
  external?: boolean;
  /** The record's picture; `src: null` shows the "no picture yet" placeholder. */
  thumbnail?: { src: string | null; missingLabel?: string };
  /**
   * For lists with something new to read (an inbox): a filled dot before the row, a semibold
   * title and "Unread" first in its accessible name. Pass false on read rows so every row keeps
   * the dot's slot and the titles line up.
   */
  unread?: boolean;
}) {
  if (unread !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", unread ? "bg-staff-fg" : "bg-transparent")}
        />
        <PrimaryCell
          {...(href !== undefined ? { href } : {})}
          {...(Link ? { Link } : {})}
          {...(thumbnail ? { thumbnail } : {})}
          secondary={secondary}
          external={external}
        >
          {unread ? (
            <>
              <span className="sr-only">Unread. </span>
              <span className="font-semibold">{children}</span>
            </>
          ) : (
            children
          )}
        </PrimaryCell>
      </span>
    );
  }
  if (thumbnail) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        <CellThumbnail
          src={thumbnail.src}
          {...(thumbnail.missingLabel ? { label: thumbnail.missingLabel } : {})}
        />
        <PrimaryCell
          {...(href !== undefined ? { href } : {})}
          {...(Link ? { Link } : {})}
          secondary={secondary}
          external={external}
        >
          {children}
        </PrimaryCell>
      </span>
    );
  }
  const label = href ? (
    external || !Link ? (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cn(staffCellLinkClass, "font-medium text-staff-fg")}
      >
        {children}
      </a>
    ) : (
      <Link href={href} className={cn(staffCellLinkClass, "font-medium text-staff-fg")}>
        {children}
      </Link>
    )
  ) : (
    <span className="block truncate font-medium text-staff-fg">{children}</span>
  );
  if (isEmptyCellValue(secondary)) return label;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 leading-[18px] [&>a]:leading-[18px]">{label}</span>
      <span className="truncate text-staff-xs leading-4 text-staff-muted">{secondary}</span>
    </span>
  );
}

/**
 * Two lines in a cell at regular weight: what it is, and a muted detail under it ("Northbank
 * Gallery" over "Lena Fischer"). For a cell that is not the row's title.
 */
export function StackedCell({
  children,
  secondary,
}: {
  children: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate leading-[18px] text-staff-fg">{children}</span>
      {isEmptyCellValue(secondary) ? null : (
        <span className="truncate text-staff-xs leading-4 text-staff-muted">{secondary}</span>
      )}
    </span>
  );
}

/** A secondary link in a cell (a buyer, a seller): same as the primary link, regular weight. */
export function CellLink({
  href,
  Link,
  children,
  external = false,
}: {
  href: string;
  Link?: LinkComponent;
  children: React.ReactNode;
  external?: boolean;
}) {
  if (external || !Link) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={staffCellLinkClass}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={staffCellLinkClass}>
      {children}
    </Link>
  );
}

/**
 * A date as every list shows it, "24 Oct 2026" in London time, with the exact time and zone
 * ("24 Oct 2026, 14:05 BST") on hover and in the `<time>` element. Empty when there is no date.
 */
export function StaffDate({
  value,
  withTime = false,
  className,
}: {
  value: string | number | Date | null | undefined;
  /** Shows the time in the cell as well, for lists where the moment matters. */
  withTime?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined || value === "") return <EmptyValue />;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <EmptyValue />;
  const exact = formatStaffDateTime(date, { zoneLabel: true });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={date.toISOString()}
          className={cn("text-staff-muted tabular-nums", className)}
        >
          {withTime ? exact : formatStaffDate(date)}
        </time>
      </TooltipTrigger>
      <TooltipContent
        {...STAFF_LAYER}
        side="top"
        sideOffset={6}
        className="rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium text-staff-on-ink shadow-staff-md"
      >
        {exact}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * An amount in minor units, "£1,250.00" or "−£20.00", in tabular figures. Put it in a `numeric`
 * column so it right-aligns with the rest of the column.
 */
export function StaffMoney({
  minor,
  currency = "GBP",
}: {
  minor: number | null | undefined;
  currency?: string;
}) {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return <EmptyValue />;
  return <span className="tabular-nums">{formatStaffMoney(minor, currency)}</span>;
}

/**
 * A person in a cell: a 24px avatar with their initials at 12px, the name (a link when `href` is
 * given) and an optional muted second line, usually the email. Work done by the platform itself
 * (`kind: "system"`) shows a cog instead of initials, so "System" never reads as a person called S.
 */
export function PersonCell({
  name,
  secondary,
  href,
  Link,
  kind = "person",
}: {
  name: string;
  secondary?: React.ReactNode;
  href?: string | null;
  Link?: LinkComponent;
  kind?: "person" | "system";
}) {
  const label =
    href && Link ? (
      <Link href={href} className={cn(staffCellLinkClass, "font-medium text-staff-fg")}>
        {name}
      </Link>
    ) : (
      <span className="block truncate font-medium text-staff-fg">{name}</span>
    );
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        data-slot="avatar"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-staff-neutral-bg text-staff-xs font-semibold text-staff-neutral-fg"
      >
        {kind === "system" ? <Cog className="size-3.5" strokeWidth={1.75} /> : initialsOf(name)}
      </span>
      {isEmptyCellValue(secondary) ? (
        <span className="flex min-w-0">{label}</span>
      ) : (
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 leading-[18px] [&>a]:leading-[18px]">{label}</span>
          <span className="truncate text-staff-xs leading-4 text-staff-muted">{secondary}</span>
        </span>
      )}
    </span>
  );
}
