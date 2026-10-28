"use client";

import { ToggleGroup, ToggleGroupItem } from "@auction/ui/components/toggle-group";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffLinkComponent } from "../shell/link.js";
import { StaffButton } from "./button.js";
import { StaffMenu, StaffMenuContent, StaffMenuItem, StaffMenuTrigger } from "./menu.js";

/** A count beside a tab or nav label, in tabular figures. */
const COUNT = new Intl.NumberFormat("en-GB");
const COMPACT_COUNT = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 0,
});

/** A count in full ("1,284"); above 99,999 in compact form ("312k") so a tab keeps its size. */
export function formatCount(value: number): string {
  return value > 99_999 ? COMPACT_COUNT.format(value) : COUNT.format(value);
}

export type CountTone = "neutral" | "attention";

export function Count({
  value,
  tone = "neutral",
  label,
  className,
}: {
  value: number;
  tone?: CountTone;
  /** Read after the number by assistive technology: "3 waiting". */
  label?: string;
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
      {formatCount(value)}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}

export type TabNavItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
  /** `attention` fills the count in ink, for work waiting on staff. */
  countTone?: CountTone;
  /** What the count means, for assistive technology ("waiting"). */
  countLabel?: string;
};

/** A tab's count, in the tone and with the meaning its item gives. */
function TabCount({ item }: { item: TabNavItem }) {
  if (item.count === undefined) return null;
  return (
    <Count
      value={item.count}
      {...(item.countTone ? { tone: item.countTone } : {})}
      {...(item.countLabel ? { label: item.countLabel } : {})}
    />
  );
}

/**
 * Page-level tabs that are links (record sections): each is a real URL, so it can be opened in a
 * new tab and the back button works. The same tabs as a list's views, with a hairline under the
 * row; at narrow widths the tabs that do not fit go into "More".
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
    <div className={cn("flex border-b border-staff-line", className)}>
      <OverflowTabs tabs={items} currentId={activeId} Link={Link} label={label} />
    </div>
  );
}

const tabClass = (active: boolean) =>
  cn(
    "staff-focus relative flex h-10 shrink-0 items-center gap-1.5 rounded-staff-xs px-2.5 text-staff-sm font-medium whitespace-nowrap transition-colors",
    "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
    active ? "text-staff-fg after:bg-staff-ink" : "text-staff-muted hover:text-staff-fg",
  );

/** Width assumed for the "More" button until it has been rendered and measured. */
const ESTIMATED_MORE_WIDTH = 76;

/**
 * Which tabs fit on one line. The active tab always stays visible, taking the place of the last
 * one that fits; the rest go into "More", whose measured width (`moreWidth`) is kept free. Before
 * the first measurement (and where nothing can be measured) every tab shows.
 */
export function fitViewTabs(
  widths: readonly number[],
  available: number,
  activeIndex: number,
  gap = 2,
  moreWidth = ESTIMATED_MORE_WIDTH,
): { visible: number[]; overflow: number[] } {
  const all = widths.map((_, index) => index);
  const total = widths.reduce((sum, width) => sum + width + gap, 0);
  if (available <= 0 || total <= available) return { visible: all, overflow: [] };
  const room = available - moreWidth - gap;
  const visible: number[] = [];
  let used = 0;
  for (const index of all) {
    const width = (widths[index] ?? 0) + gap;
    if (used + width > room) break;
    visible.push(index);
    used += width;
  }
  if (activeIndex >= 0 && !visible.includes(activeIndex)) {
    const activeWidth = (widths[activeIndex] ?? 0) + gap;
    while (visible.length > 0 && used + activeWidth > room) {
      const dropped = visible.pop() as number;
      used -= (widths[dropped] ?? 0) + gap;
    }
    visible.push(activeIndex);
  }
  visible.sort((a, b) => a - b);
  return { visible, overflow: all.filter((index) => !visible.includes(index)) };
}

/**
 * Tabs that are links, on one line, in sentence case, with an ink underline under the current
 * one and the same `Count` beside any label that has one. When they do not fit, the ones that do
 * not go into a "More" menu instead of scrolling out of sight; the current tab always stays.
 * List views (`DataViews`) and record sections (`TabNav`) both use it, so tabs look and behave
 * the same everywhere.
 */
export function OverflowTabs({
  tabs,
  currentId,
  Link,
  label,
}: {
  tabs: readonly TabNavItem[];
  currentId: string | null;
  Link: StaffLinkComponent;
  /** The navigation's accessible name: "Views", "Payout sections". */
  label: string;
}) {
  const navRef = React.useRef<HTMLElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const moreRef = React.useRef<HTMLLIElement>(null);
  const [moreWidth, setMoreWidth] = React.useState(ESTIMATED_MORE_WIDTH);
  const activeIndex = tabs.findIndex((tab) => tab.id === currentId);
  const signature = `${tabs.map((tab) => `${tab.id}:${tab.label}:${tab.count ?? ""}:${tab.countTone ?? ""}`).join("|")}#${activeIndex}`;
  const widths = React.useRef<{ signature: string; values: number[] } | null>(null);
  const [fit, setFit] = React.useState<{
    signature: string;
    visible: number[];
    overflow: number[];
  } | null>(null);
  const current = fit?.signature === signature ? fit : null;

  // A change of tabs renders every tab again (the fit no longer matches), so this effect measures
  // them all once; later resizes reuse those widths, since hidden tabs cannot be measured.
  // biome-ignore lint/correctness/useExhaustiveDependencies: signature covers the tabs and the active one
  React.useLayoutEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    if (!nav || !list) return;
    if (widths.current?.signature !== signature) {
      widths.current = {
        signature,
        values: Array.from(list.children, (child) => (child as HTMLElement).offsetWidth).slice(
          0,
          tabs.length,
        ),
      };
    }
    const update = () => {
      if (!widths.current) return;
      const next = fitViewTabs(
        widths.current.values,
        nav.clientWidth,
        activeIndex,
        undefined,
        moreWidth,
      );
      setFit((previous) =>
        previous?.signature === signature &&
        previous.visible.join() === next.visible.join() &&
        previous.overflow.join() === next.overflow.join()
          ? previous
          : { signature, ...next },
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [signature, moreWidth]);

  // The button only exists while something overflows, so its real width is read once it is there
  // and the fit runs again with exactly that room.
  React.useLayoutEffect(() => {
    const width = moreRef.current?.offsetWidth;
    if (width && width !== moreWidth) setMoreWidth(width);
  });

  const visible = current?.visible ?? tabs.map((_, index) => index);
  const overflow = current?.overflow ?? [];

  const content = (view: TabNavItem) => (
    <>
      {view.label}
      <TabCount item={view} />
    </>
  );

  return (
    <nav aria-label={label} ref={navRef} className="min-w-0 flex-1 overflow-hidden">
      <ul ref={listRef} className="flex items-center gap-0.5">
        {visible.map((index) => {
          const view = tabs[index];
          if (!view) return null;
          const active = view.id === currentId;
          return (
            <li key={view.id} className="shrink-0">
              <Link
                href={view.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={tabClass(active)}
              >
                {content(view)}
              </Link>
            </li>
          );
        })}
        {overflow.length > 0 ? (
          <li ref={moreRef}>
            <StaffMenu>
              <StaffMenuTrigger asChild>
                <StaffButton
                  variant="ghost"
                  size="sm"
                  className="text-staff-muted"
                  aria-label={`More ${label.toLowerCase()}, ${overflow.length}`}
                >
                  More
                  <ChevronDown aria-hidden />
                </StaffButton>
              </StaffMenuTrigger>
              <StaffMenuContent align="start" className="w-56">
                {overflow.map((index) => {
                  const view = tabs[index];
                  if (!view) return null;
                  return (
                    <StaffMenuItem key={view.id} asChild>
                      <Link href={view.href} className="flex w-full items-center justify-between">
                        {content(view)}
                      </Link>
                    </StaffMenuItem>
                  );
                })}
              </StaffMenuContent>
            </StaffMenu>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * The pages inside one record tab, as a quieter row of links under it: a sale's "Bidders" tab
 * holds Registrations and Telephone bookings. Each is a real URL. The current one sits on a
 * selected fill rather than an underline, so the two levels never read as one row. A group holds
 * two or three pages, which fit at 375px; a longer row scrolls sideways rather than wrapping.
 */
export function SecondaryTabNav({
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
        // The scroll box clips; 4px of padding (cancelled by the margin) keeps the focus ring whole.
        "-m-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ul className="flex w-max items-center gap-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={cn(
                  "staff-focus staff-target inline-flex h-control-sm items-center justify-center gap-1.5 rounded-staff-sm px-3 text-staff-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "staff-overlay-selected text-staff-fg ring-1 ring-staff-line ring-inset"
                    : "text-staff-muted hover:text-staff-fg active:staff-overlay-pressed",
                )}
              >
                {item.label}
                <TabCount item={item} />
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
      // A non-zero spacing keeps the shared primitive from drawing joined-segment borders.
      spacing={1}
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
            "data-[state=on]:bg-staff-raised data-[state=on]:text-staff-fg data-[state=on]:shadow-staff-xs",
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
