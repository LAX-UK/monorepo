"use client";

import { ChevronLeft, ChevronRight, ListFilter, Plus, Rows3, Rows4, Search, X } from "lucide-react";
import * as React from "react";
import { Field } from "../forms/field.js";
import { cn } from "../lib/cn.js";
import { StaffDialog } from "../panels/staff-dialog.js";
import { StaffButton } from "../primitives/button.js";
import { TextInput } from "../primitives/input.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import { Count, SegmentedControl } from "../primitives/tabs.js";
import type { StaffLinkComponent } from "../shell/link.js";
import type { TableDensity } from "./types.js";

/** The rows above a table: views on top, then search, filters and view options. */
export function DataTableToolbar({
  views,
  search,
  filters,
  activeFilters,
  end,
}: {
  /** DataViews: saved and built-in views of the list. */
  views?: React.ReactNode;
  /** A TableSearch. */
  search?: React.ReactNode;
  /** FilterMenu buttons. */
  filters?: React.ReactNode;
  /** ActiveFilterChips. */
  activeFilters?: React.ReactNode;
  /** Right side: density, columns, export. */
  end?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {views ? <div className="border-b border-staff-line-subtle px-2">{views}</div> : null}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        {search}
        {filters}
        {activeFilters}
        {end ? <div className="ml-auto flex items-center gap-2">{end}</div> : null}
      </div>
    </div>
  );
}

/**
 * Search within the list. Submits on Enter (and after a pause when `live`), so a server-filtered
 * list does not refetch on every key. Escape clears.
 */
export function TableSearch({
  value,
  onSearch,
  placeholder,
  label,
  live = false,
}: {
  value: string;
  onSearch: (query: string) => void;
  placeholder: string;
  label: string;
  live?: boolean;
}) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  React.useEffect(() => {
    if (!live || text === value) return;
    const timer = window.setTimeout(() => onSearch(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [live, text, value, onSearch]);
  return (
    <form
      aria-label={label}
      className="w-full sm:w-64"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <TextInput
        size="sm"
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text) {
            event.preventDefault();
            setText("");
            onSearch("");
          }
        }}
        leading={<Search aria-hidden />}
        trailing={
          text ? (
            <StaffButton
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="-mr-1.5 [&_svg]:size-3.5"
              onClick={() => {
                setText("");
                onSearch("");
              }}
            >
              <X aria-hidden />
            </StaffButton>
          ) : null
        }
      />
    </form>
  );
}

export type FilterOption = { value: string; label: string; count?: number };

/** A filter as a button that opens a checklist; shows how many values are on. */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const active = selected.length;
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<ListFilter aria-hidden />}
          className={cn(active > 0 && "border-staff-line-hover")}
        >
          {label}
          {active > 0 ? <Count value={active} tone="attention" /> : null}
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="start" className="w-60">
        <StaffMenuLabel>{label}</StaffMenuLabel>
        {options.map((option) => (
          <StaffMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )
            }
          >
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined ? (
              <span className="text-staff-xs text-staff-muted tabular-nums">{option.count}</span>
            ) : null}
          </StaffMenuCheckboxItem>
        ))}
        {active > 0 ? (
          <>
            <StaffMenuSeparator />
            <StaffMenuCheckboxItem checked={false} onCheckedChange={() => onChange([])}>
              Clear {label.toLowerCase()} filter
            </StaffMenuCheckboxItem>
          </>
        ) : null}
      </StaffMenuContent>
    </StaffMenu>
  );
}

export type ActiveFilter = { id: string; label: string; onRemove: () => void };

/** Applied filters as removable chips, plus "Clear all". */
export function ActiveFilterChips({
  filters,
  onClearAll,
}: {
  filters: readonly ActiveFilter[];
  onClearAll?: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-1.5">
      {filters.map((filter) => (
        <li key={filter.id}>
          <span className="inline-flex h-control-xs items-center gap-1 rounded-staff-xs border border-staff-line bg-staff-sunken pr-0.5 pl-2 text-staff-xs font-medium text-staff-fg">
            {filter.label}
            <StaffButton
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove filter: ${filter.label}`}
              onClick={filter.onRemove}
              className="size-5 [&_svg]:size-3"
            >
              <X aria-hidden />
            </StaffButton>
          </span>
        </li>
      ))}
      {onClearAll && filters.length > 1 ? (
        <li>
          <StaffButton
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-control-xs px-2 text-staff-xs"
          >
            Clear all
          </StaffButton>
        </li>
      ) : null}
    </ul>
  );
}

/** Compact or comfortable rows; remembered per list in this browser. */
export function DensityToggle({
  value,
  onChange,
}: {
  value: TableDensity;
  onChange: (density: TableDensity) => void;
}) {
  return (
    <SegmentedControl
      label="Row density"
      value={value}
      onValueChange={onChange}
      options={[
        {
          value: "comfortable",
          label: "Comfortable rows",
          icon: <Rows3 aria-hidden />,
          iconOnly: true,
        },
        { value: "compact", label: "Compact rows", icon: <Rows4 aria-hidden />, iconOnly: true },
      ]}
    />
  );
}

export function useTableDensity(storageKey: string, initial: TableDensity = "comfortable") {
  const [density, setDensity] = React.useState<TableDensity>(initial);
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`staff.density.${storageKey}`);
      if (stored === "compact" || stored === "comfortable") setDensity(stored);
    } catch {
      // Storage unavailable (private mode): keep the default.
    }
  }, [storageKey]);
  const update = React.useCallback(
    (next: TableDensity) => {
      setDensity(next);
      try {
        window.localStorage.setItem(`staff.density.${storageKey}`, next);
      } catch {
        // Storage unavailable: the choice lasts for this page only.
      }
    },
    [storageKey],
  );
  return [density, update] as const;
}

export type DataView = {
  id: string;
  label: string;
  href: string;
  count?: number;
  custom?: boolean;
};

/**
 * Built-in and saved views of a list as tabs: each is a URL, so a view can be bookmarked or
 * shared. Saved views can be removed; "Save view" stores the current filters under a name.
 */
export function DataViews({
  views,
  activeId,
  Link,
  onSaveCurrent,
  onRemove,
}: {
  views: readonly DataView[];
  activeId: string | null;
  Link: StaffLinkComponent;
  /** Saves the current filters under the name staff give; offers "Save view" when set. */
  onSaveCurrent?: (label: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const close = () => {
    setNaming(false);
    setName("");
  };
  return (
    <nav
      aria-label="Views"
      className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
    >
      <ul className="flex min-w-max items-center gap-0.5">
        {views.map((view) => {
          const active = view.id === activeId;
          return (
            <li key={view.id} className="group/view relative flex items-center">
              <Link
                href={view.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={cn(
                  "staff-focus relative flex h-10 items-center gap-1.5 rounded-staff-xs px-2.5 text-staff-sm font-medium transition-colors",
                  "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
                  active
                    ? "text-staff-fg after:bg-staff-ink"
                    : "text-staff-muted hover:text-staff-fg",
                  view.custom && onRemove && "pr-7",
                )}
              >
                {view.label}
                {view.count !== undefined ? <Count value={view.count} /> : null}
              </Link>
              {view.custom && onRemove ? (
                <StaffButton
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove saved view: ${view.label}`}
                  onClick={() => onRemove(view.id)}
                  className="absolute right-1 size-5 opacity-0 group-hover/view:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
                >
                  <X aria-hidden />
                </StaffButton>
              ) : null}
            </li>
          );
        })}
      </ul>
      {onSaveCurrent ? (
        <StaffButton
          variant="ghost"
          size="sm"
          icon={<Plus aria-hidden />}
          onClick={() => setNaming(true)}
          className="ml-1 shrink-0 text-staff-muted"
        >
          Save view
        </StaffButton>
      ) : null}
      {onSaveCurrent ? (
        <StaffDialog
          open={naming}
          onOpenChange={(open) => (open ? setNaming(true) : close())}
          title="Save view"
          description="Keeps the current search and filters as a view in this browser."
          footer={
            <>
              <StaffButton variant="secondary" onClick={close}>
                Cancel
              </StaffButton>
              <StaffButton
                variant="primary"
                type="submit"
                form="staff-save-view"
                disabled={!name.trim()}
              >
                Save view
              </StaffButton>
            </>
          }
        >
          <form
            id="staff-save-view"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              onSaveCurrent(name.trim());
              close();
            }}
          >
            <Field label="Name">
              <TextInput
                autoFocus
                maxLength={40}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Paid this week"
              />
            </Field>
          </form>
        </StaffDialog>
      ) : null}
    </nav>
  );
}

export type SavedView = { id: string; label: string; query: string };

/** Views a person saved for a list, kept in this browser. */
export function useSavedViews(listKey: string) {
  const storageKey = `staff.views.${listKey}`;
  const [views, setViews] = React.useState<SavedView[]>([]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setViews(
          parsed.filter(
            (view): view is SavedView =>
              typeof view?.id === "string" &&
              typeof view?.label === "string" &&
              typeof view?.query === "string",
          ),
        );
      }
    } catch {
      setViews([]);
    }
  }, [storageKey]);
  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage unavailable: views last for this page only.
    }
  };
  return {
    views,
    save: (label: string, query: string) =>
      persist([...views, { id: `view-${Date.now().toString(36)}`, label, query }]),
    remove: (id: string) => persist(views.filter((view) => view.id !== id)),
  };
}

/**
 * "1–50 of 312" and previous/next. Works with offsets or cursors: pass hrefs (links, so pages
 * are addressable) and the range text you can compute.
 */
export function TablePagination({
  summary,
  prevHref,
  nextHref,
  prevLabel = "Previous",
  Link,
}: {
  summary: React.ReactNode;
  prevHref: string | null;
  nextHref: string | null;
  /** "First page" for cursor lists, which can only go back to the start. */
  prevLabel?: string;
  Link: StaffLinkComponent;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex h-12 items-center justify-between gap-3 px-4 text-staff-sm text-staff-muted"
    >
      <p className="tabular-nums">{summary}</p>
      <div className="flex items-center gap-1">
        {prevHref ? (
          <StaffButton asChild size="sm" variant="secondary" icon={<ChevronLeft aria-hidden />}>
            <Link href={prevHref}>{prevLabel}</Link>
          </StaffButton>
        ) : (
          <StaffButton size="sm" variant="secondary" disabled icon={<ChevronLeft aria-hidden />}>
            {prevLabel}
          </StaffButton>
        )}
        {nextHref ? (
          <StaffButton asChild size="sm" variant="secondary">
            <Link href={nextHref}>
              Next
              <ChevronRight aria-hidden />
            </Link>
          </StaffButton>
        ) : (
          <StaffButton size="sm" variant="secondary" disabled>
            Next
            <ChevronRight aria-hidden />
          </StaffButton>
        )}
      </div>
    </nav>
  );
}
