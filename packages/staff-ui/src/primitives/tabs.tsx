"use client";

import { ToggleGroup, ToggleGroupItem } from "@auction/ui/components/toggle-group";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffLinkComponent } from "../shell/link.js";

/** A count beside a tab or nav label, in tabular figures. */
export function Count({
  value,
  tone = "neutral",
  className,
}: {
  value: number;
  tone?: "neutral" | "attention";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-staff-2xs font-medium tabular-nums",
        tone === "attention"
          ? "bg-staff-ink text-staff-on-ink"
          : "bg-staff-neutral-bg text-staff-neutral-fg",
        className,
      )}
    >
      {value > 999 ? "999+" : value}
    </span>
  );
}

export type TabNavItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
};

/**
 * Page-level tabs that are links (detail sections, saved views): each is a real URL, so they can
 * be opened in a new tab and the back button works. The active tab has an ink underline and
 * `aria-current="page"`. Scrolls sideways on a phone rather than wrapping.
 */
export function TabNav({
  items,
  activeId,
  label,
  Link,
  className,
}: {
  items: readonly TabNavItem[];
  activeId: string;
  label: string;
  Link: StaffLinkComponent;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0",
        "border-b border-staff-line",
        className,
      )}
    >
      <ul className="flex min-w-max gap-4">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={cn(
                  "relative -mb-px flex h-control-md items-center gap-1.5 border-b-2 text-staff-sm font-medium",
                  "staff-focus rounded-t-staff-xs transition-colors duration-150",
                  active
                    ? "border-staff-ink text-staff-fg"
                    : "border-transparent text-staff-muted hover:border-staff-line-strong hover:text-staff-fg",
                )}
              >
                {item.label}
                {item.count !== undefined ? <Count value={item.count} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Icon-only segments must still pass a label; it becomes the accessible name. */
  icon?: React.ReactNode;
  iconOnly?: boolean;
};

/**
 * Two to four mutually exclusive choices in one control (density, period, layout). The selected
 * segment lifts onto the surface; the track is sunken.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next);
        if (match) onValueChange(match.value);
      }}
      className={cn(
        "inline-flex gap-0.5 rounded-staff-sm bg-staff-sunken p-0.5 shadow-none ring-1 ring-staff-line ring-inset",
        size === "sm" ? "h-control-sm" : "h-control-md",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className={cn(
            "h-full min-w-0 gap-1.5 rounded-staff-xs border-0 px-2.5 font-staff text-staff-sm font-medium text-staff-muted shadow-none",
            "staff-focus focus-visible:ring-0",
            "hover:bg-transparent hover:text-staff-fg",
            "data-[state=on]:bg-staff-surface data-[state=on]:text-staff-fg data-[state=on]:shadow-staff-xs",
            "data-[state=on]:ring-1 data-[state=on]:ring-staff-line",
            "[&_svg]:size-4",
            option.iconOnly && "px-1.5",
          )}
        >
          {option.icon}
          {option.iconOnly ? null : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
