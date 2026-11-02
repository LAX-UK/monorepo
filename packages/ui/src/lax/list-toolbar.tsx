"use client";

import { ArrowUpDown, Check, ListFilter, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { formatCount } from "./count.js";
import { Dialog, DialogClose } from "./dialog.js";
import { TextInput } from "./input.js";
import type { LinkComponent } from "./link.js";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./menu.js";
import { TabNav, type TabNavItem } from "./tabs.js";

/* ------------------------------------------------------------------------------------------------
 * The list toolbar: tabs with counts, search, Filter with a count and a sheet, Sort, the applied
 * filters as removable chips, and "Showing n of m" under the list. Each part works alone; the
 * `ListToolbar` lays them out in the one order every list uses.
 * --------------------------------------------------------------------------------------------- */

export type ListSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Names what is searched: "Search by artist, title or reference". */
  placeholder: string;
  /** The field's accessible name; defaults to the placeholder. */
  label?: string;
};

/** The list's search field, with a clear button once there is something to clear. */
export function ListSearch({ value, onValueChange, placeholder, label }: ListSearchProps) {
  return (
    <TextInput
      type="search"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      leading={<Search aria-hidden />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label="Clear search"
            className="-mr-1.5 inline-flex size-6 items-center justify-center rounded-lax-badge text-lax-muted hover:bg-lax-hover hover:text-lax-fg lax-focus"
          >
            <X aria-hidden />
          </button>
        ) : null
      }
      boxClassName="min-w-0 flex-1"
    />
  );
}

/** Opens the filter sheet; the count says how many filters are applied. */
export function FilterButton({
  count,
  onClick,
  expanded,
}: {
  count: number;
  onClick: () => void;
  expanded: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      icon={<ListFilter aria-hidden />}
    >
      Filter
      {count > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lax-ink px-1.5 text-lax-12 font-medium text-lax-on-ink tabular-nums">
          {formatCount(count)}
          <span className="sr-only"> applied</span>
        </span>
      ) : null}
    </Button>
  );
}

export type SortOption<T extends string> = { value: T; label: string };

/** The list's order, as a menu of choices; the button names the current one. */
export function SortMenu<T extends string>({
  value,
  onValueChange,
  options,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SortOption<T>[];
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button icon={<ArrowUpDown aria-hidden />} aria-label={`Sort: ${current?.label ?? ""}`}>
          {current?.label ?? "Sort"}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next);
            if (match) onValueChange(match.value);
          }}
        >
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export type AppliedFilter = {
  id: string;
  /** "Sent by: Lena Fischer". */
  label: string;
};

/**
 * The applied filters as chips, each with its own remove button, then "Clear all". Removing a
 * chip moves focus to the next one, or to "Clear all" after the last, so a keyboard user is never
 * dropped at the top of the page.
 */
export function FilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: readonly AppliedFilter[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const clearRef = React.useRef<HTMLButtonElement>(null);
  if (filters.length === 0) return null;
  const remove = (index: number, id: string) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-remove]");
    const next = buttons?.[index + 1] ?? buttons?.[index - 1];
    onRemove(id);
    (next ?? clearRef.current)?.focus();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul ref={listRef} aria-label="Applied filters" className="contents">
        {filters.map((filter, index) => (
          <li
            key={filter.id}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-lax-surface pr-1 pl-2.5 text-lax-13 font-medium text-lax-fg shadow-[inset_0_0_0_1px_var(--lax-line-strong)]"
          >
            {filter.label}
            <button
              type="button"
              data-remove=""
              onClick={() => remove(index, filter.id)}
              aria-label={`Remove filter ${filter.label}`}
              className="inline-flex size-5 items-center justify-center rounded-full text-lax-muted hover:bg-lax-hover hover:text-lax-fg lax-focus [&_svg]:size-3.5"
            >
              <X aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button
        ref={clearRef}
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="underline underline-offset-2"
      >
        Clear all
      </Button>
    </div>
  );
}

/**
 * The filters, in a sheet: on the right from 768px, from the bottom on a phone. The page owns
 * the fields; the sheet holds them and the two actions. "Show n results" applies and closes.
 */
export function FilterSheet({
  open,
  onOpenChange,
  children,
  resultCount,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** How many records the chosen filters match, when known. */
  resultCount?: number;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      placement="side"
      title="Filter"
      footer={
        <>
          <Button variant="ghost" onClick={onClear}>
            Clear all
          </Button>
          <DialogClose asChild>
            <Button variant="primary" onClick={onApply} icon={<Check aria-hidden />}>
              {resultCount === undefined
                ? "Show results"
                : `Show ${formatCount(resultCount)} ${resultCount === 1 ? "result" : "results"}`}
            </Button>
          </DialogClose>
        </>
      }
    >
      <div className="flex flex-col gap-6">{children}</div>
    </Dialog>
  );
}

/** "Showing 5 of 14" under a list, with "Show more" while there is more. */
export function ShowingCount({
  shown,
  total,
  onShowMore,
  loading = false,
}: {
  shown: number;
  total: number;
  onShowMore?: () => void;
  loading?: boolean;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <p aria-live="polite" className="text-lax-13 text-lax-muted tabular-nums">
        {shown >= total
          ? `Showing all ${formatCount(total)}`
          : `Showing ${formatCount(shown)} of ${formatCount(total)}`}
      </p>
      {onShowMore && shown < total ? (
        <Button size="sm" onClick={onShowMore} loading={loading}>
          Show more
        </Button>
      ) : null}
    </div>
  );
}

export type ListToolbarProps = {
  /** The list's views, as links with counts. */
  tabs?: {
    items: readonly TabNavItem[];
    activeId: string;
    label: string;
    Link: LinkComponent;
    /** See `TabNav`: a short fixed set of views may scroll instead of folding into "More". */
    overflow?: "menu" | "scroll";
  };
  search?: ListSearchProps;
  /** The filter button opens the sheet; the page renders `FilterSheet` with its fields. */
  filter?: { count: number; open: boolean; onOpenChange: (open: boolean) => void };
  /** The sort menu, rendered by the page so its value type is its own. */
  sort?: React.ReactNode;
  /** The applied filters; shown as chips under the controls. */
  chips?: React.ComponentProps<typeof FilterChips>;
  className?: string;
};

/**
 * The toolbar above every client list, in one order: tabs, then search with Filter and Sort,
 * then the applied filters. On a phone the tabs scroll sideways, search takes its own row and
 * Filter and Sort share the next.
 */
export function ListToolbar({ tabs, search, filter, sort, chips, className }: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {tabs ? (
        <TabNav
          items={tabs.items}
          activeId={tabs.activeId}
          label={tabs.label}
          Link={tabs.Link}
          {...(tabs.overflow ? { overflow: tabs.overflow } : {})}
        />
      ) : null}
      {search || filter || sort ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {search ? (
            <div className="flex min-w-0 md:max-w-[340px] md:flex-1">
              <ListSearch {...search} />
            </div>
          ) : null}
          {filter || sort ? (
            <div className="flex items-center gap-2 max-md:[&>*]:flex-1">
              {filter ? (
                <FilterButton
                  count={filter.count}
                  expanded={filter.open}
                  onClick={() => filter.onOpenChange(true)}
                />
              ) : null}
              {sort}
            </div>
          ) : null}
        </div>
      ) : null}
      {chips ? <FilterChips {...chips} /> : null}
    </div>
  );
}
