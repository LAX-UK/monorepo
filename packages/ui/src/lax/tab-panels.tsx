"use client";

import * as React from "react";
import { ScrollRow } from "../components/ui/scroll-row.js";
import { cn } from "../lib/utils.js";

export type TabPanelItem = {
  id: string;
  /** The tab's first line, in the tab text style. */
  label: React.ReactNode;
  /** An optional second line: small, muted, tabular (a close time, a count). */
  detail?: React.ReactNode;
  /** The accessible name when it differs from the visible text. */
  name?: string;
  panel: React.ReactNode;
};

/**
 * Tabs that switch a panel in place, with no URL change: a tablist of tabs and one tabpanel
 * each. Arrow keys, Home and End move between tabs (one tab stop, roving focus). Every panel is
 * rendered and stacked in one cell, so the region keeps the height of the tallest and nothing
 * moves when the tab changes; inactive panels are inert and hidden from assistive technology.
 * The row scrolls sideways when the tabs do not fit, with a fade at the edge while more remain;
 * `trailing` (a link such as "All live sales") ends the row, after the tabs.
 *
 * Use `TabNav` when each tab is its own page and URL, and `SegmentedControl` for two to four
 * short options that change a view setting. Use `Tabs` when the choices are peer content that the
 * reader switches between on one page.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
  trailing,
  className,
  barClassName,
}: {
  items: readonly TabPanelItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Accessible name of the tablist. */
  label: string;
  trailing?: React.ReactNode;
  className?: string;
  /** Added to the row of tabs only, to line it up with a page shell the panels must escape. */
  barClassName?: string;
}) {
  const base = React.useId();
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const at = items.findIndex((item) => item.id === value);
    const last = items.length - 1;
    const target =
      event.key === "ArrowRight"
        ? items[at >= last ? 0 : at + 1]
        : event.key === "ArrowLeft"
          ? items[at <= 0 ? last : at - 1]
          : event.key === "Home"
            ? items[0]
            : event.key === "End"
              ? items[last]
              : undefined;
    if (!target) return;
    event.preventDefault();
    onValueChange(target.id);
    const node = tabRefs.current.get(target.id);
    node?.focus();
    node?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className={className}>
      <div className={cn("flex min-w-0 items-center gap-4 border-b border-lax-line", barClassName)}>
        <ScrollRow className="-ml-2.5 flex flex-1 items-center">
          <div className="flex w-max items-stretch">
            <div
              role="tablist"
              aria-label={label}
              onKeyDown={onKeyDown}
              className="flex items-stretch gap-0.5"
            >
              {items.map((item) => {
                const active = item.id === value;
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) tabRefs.current.set(item.id, node);
                      else tabRefs.current.delete(item.id);
                    }}
                    type="button"
                    role="tab"
                    id={tabId(item.id)}
                    aria-selected={active}
                    aria-controls={panelId(item.id)}
                    aria-label={item.name}
                    tabIndex={active ? 0 : -1}
                    onClick={() => onValueChange(item.id)}
                    className={cn(
                      "lax-focus relative flex min-h-11 max-w-[72vw] shrink-0 flex-col items-start justify-center rounded-lax-control px-2.5 py-1.5 text-left md:max-w-none",
                      "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
                      active ? "after:bg-lax-ink" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "max-w-full truncate text-lax-ui font-medium",
                        active ? "text-lax-fg" : "text-lax-muted",
                      )}
                    >
                      {item.label}
                    </span>
                    {item.detail ? (
                      <span className="max-w-full truncate text-[12px] leading-4 text-lax-muted tabular-nums md:text-[13px]">
                        {item.detail}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {trailing ? (
              <span className="flex shrink-0 items-center px-3 md:hidden">{trailing}</span>
            ) : null}
          </div>
        </ScrollRow>
        {trailing ? <span className="shrink-0 max-md:hidden">{trailing}</span> : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)]">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <div
              key={item.id}
              role="tabpanel"
              id={panelId(item.id)}
              aria-labelledby={tabId(item.id)}
              inert={!active}
              className={cn("col-start-1 row-start-1", !active && "invisible")}
            >
              {item.panel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
