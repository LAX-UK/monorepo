"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import type * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { formatStaffDate, formatStaffDateTime, formatStaffMoney } from "../lib/format.js";
import type { StaffLinkComponent } from "../shell/link.js";

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
 * The row's first cell: what the row is, as a real link (so cmd-click opens a new tab) in medium
 * weight, and an optional muted second line ("Lot 12 · Autumn sale"). Lists whose first cell
 * has a second line default to comfortable rows; keep the line to one short fact or two.
 */
export function PrimaryCell({
  children,
  href,
  Link,
  secondary,
  external = false,
}: {
  children: React.ReactNode;
  href?: string | null;
  Link?: StaffLinkComponent;
  secondary?: React.ReactNode;
  /** Opens outside the tool, in a new tab. */
  external?: boolean;
}) {
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

/** A secondary link in a cell (a buyer, a seller): same as the primary link, regular weight. */
export function CellLink({
  href,
  Link,
  children,
  external = false,
}: {
  href: string;
  Link?: StaffLinkComponent;
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
