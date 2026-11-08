"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";
import { ScrollRow } from "../components/ui/scroll-row.js";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.js";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { formatCount } from "./count.js";
import type { LinkComponent } from "./link.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu.js";
import { ESTIMATED_MORE_WIDTH, fitViewTabs } from "./tabs-fit.js";

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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-lax-12 font-medium tabular-nums",
        tone === "attention"
          ? "bg-lax-ink text-lax-on-ink"
          : "bg-lax-neutral-bg text-lax-neutral-fg",
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
  /** `attention` fills the count in ink, for work waiting on the reader. */
  countTone?: CountTone;
  /** What the count means, for assistive technology ("waiting"). */
  countLabel?: string;
  /**
   * Marks the item that is current. `page` (the default) is the page being viewed; `true` is the
   * section in view on a page of in-page links.
   */
  currentKind?: "page" | "true";
  /** For in-page links that scroll to a section instead of navigating. */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

/** The props a tab link takes from its item: the current marker and any click handler. */
function tabLinkProps(item: TabNavItem, active: boolean) {
  return {
    ...(active ? { "aria-current": item.currentKind ?? ("page" as const) } : {}),
    ...(item.onClick ? { onClick: item.onClick } : {}),
  };
}

/** A tab's count, in the tone and with the meaning its item gives. */
function TabCount({ item }: { item: TabNavItem }) {
  if (item.count === undefined) return null;
  return (
    <Count
      className="shrink-0"
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
  overflow = "menu",
  className,
}: {
  items: readonly TabNavItem[];
  activeId: string;
  label: string;
  Link: LinkComponent;
  /**
   * What happens when the tabs don't fit: `menu` moves the rest into "More"; `scroll` keeps a
   * short, fixed set of views in one row that scrolls sideways, with a fade at the edge.
   */
  overflow?: "menu" | "scroll";
  className?: string;
}) {
  return (
    <div className={cn("flex border-b border-lax-line", className)}>
      {overflow === "scroll" ? (
        <ScrollingTabs tabs={items} currentId={activeId} Link={Link} label={label} />
      ) : (
        <OverflowTabs tabs={items} currentId={activeId} Link={Link} label={label} />
      )}
    </div>
  );
}

/**
 * Tabs in one row that scrolls sideways when it doesn't fit, so every view stays one swipe away.
 * The edge fades while there is more to see, and the current tab is scrolled into view.
 */
function ScrollingTabs({
  tabs,
  currentId,
  Link,
  label,
}: {
  tabs: readonly TabNavItem[];
  currentId: string;
  Link: LinkComponent;
  label: string;
}) {
  return (
    <ScrollRow as="nav" aria-label={label} className="flex-1">
      <ul className="flex w-max items-center gap-0.5">
        {tabs.map((view) => {
          const active = view.id === currentId;
          return (
            <li key={view.id} className="shrink-0">
              <Link href={view.href} {...tabLinkProps(view, active)} className={tabClass(active)}>
                {view.label}
                <TabCount item={view} />
              </Link>
            </li>
          );
        })}
      </ul>
    </ScrollRow>
  );
}

const tabClass = (active: boolean, squeeze = false) =>
  cn(
    // A tab that has to give way (see `OverflowTabs`) shrinks to the room it has instead of
    // being cut off; every other tab keeps its full width.
    squeeze ? "min-w-0" : "shrink-0",
    "lax-focus relative flex h-10 items-center gap-1.5 rounded-lax-control px-2.5 text-lax-ui font-medium whitespace-nowrap transition-colors",
    "in-data-[lax-density=client]:max-md:h-11",
    "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
    active ? "text-lax-fg after:bg-lax-ink" : "text-lax-muted hover:text-lax-fg",
  );

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
  Link: LinkComponent;
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

  // The current tab always stays. If it is the only one that fits and still does not fit beside
  // "More" (a narrow screen with filters in the same row), it gives way: its label is cut with an
  // ellipsis, so neither the tab nor "More" is clipped.
  const squeeze = overflow.length > 0 && visible.length === 1;

  const content = (view: TabNavItem, truncate = false) => (
    <>
      <span className={truncate ? "min-w-0 truncate" : undefined}>{view.label}</span>
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
            <li key={view.id} className={squeeze ? "min-w-0" : "shrink-0"}>
              <Link
                href={view.href}
                {...tabLinkProps(view, active)}
                className={tabClass(active, squeeze)}
              >
                {content(view, squeeze)}
              </Link>
            </li>
          );
        })}
        {overflow.length > 0 ? (
          <li ref={moreRef} className="shrink-0">
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-lax-muted"
                  aria-label={`More ${label.toLowerCase()}, ${overflow.length}`}
                >
                  More
                  <ChevronDown aria-hidden />
                </Button>
              </MenuTrigger>
              <MenuContent
                align="start"
                className="w-56"
                landmarkLabel={`More ${label.toLowerCase()}`}
              >
                {overflow.map((index) => {
                  const view = tabs[index];
                  if (!view) return null;
                  return (
                    <MenuItem key={view.id} asChild>
                      <Link href={view.href} className="flex w-full items-center justify-between">
                        {content(view)}
                      </Link>
                    </MenuItem>
                  );
                })}
              </MenuContent>
            </Menu>
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
  Link: LinkComponent;
  className?: string;
}) {
  return (
    <ScrollRow
      as="nav"
      aria-label={label}
      // The scroll box clips; 4px of padding (cancelled by the margin) keeps the focus ring whole.
      className={cn("-m-1 p-1", className)}
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
                  "lax-focus lax-target inline-flex h-lax-control-sm items-center justify-center gap-1.5 rounded-lax-control px-3 text-lax-ui font-medium whitespace-nowrap transition-colors",
                  active
                    ? "lax-overlay-selected text-lax-fg ring-1 ring-lax-line ring-inset"
                    : "text-lax-muted hover:text-lax-fg active:lax-overlay-pressed",
                )}
              >
                {item.label}
                <TabCount item={item} />
              </Link>
            </li>
          );
        })}
      </ul>
    </ScrollRow>
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
  disabled = false,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ToggleGroup
      disabled={disabled}
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
        "lax-target inline-flex gap-0.5 rounded-lax-control bg-lax-sunken p-0.5 shadow-none ring-1 ring-lax-line ring-inset",
        size === "sm" ? "h-lax-control-sm" : "h-lax-control-md",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className={cn(
            "h-full min-w-0 gap-1.5 rounded-lax-badge border-0 px-2.5 font-lax text-lax-ui font-medium text-lax-muted shadow-none",
            "lax-focus focus-visible:ring-0",
            "hover:bg-transparent hover:text-lax-fg",
            "data-[state=on]:bg-lax-raised data-[state=on]:text-lax-fg data-[state=on]:shadow-lax-xs",
            "data-[state=on]:ring-1 data-[state=on]:ring-lax-line",
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
