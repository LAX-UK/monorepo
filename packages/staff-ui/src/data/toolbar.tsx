"use client";

import {
  Count,
  Field,
  type LinkComponent,
  OverflowTabs,
  SegmentedControl,
  TextInput,
} from "@auction/ui/lax";
import { ChevronLeft, ChevronRight, ListFilter, Plus, Rows3, Rows4, Search, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "../lib/cn.js";
import { StaffDialog } from "../panels/staff-dialog.js";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import { useStaffShortcut } from "../shell/shortcuts.js";
import {
  type SavedView,
  type SavedViewsControls,
  sameViewQuery,
  viewQuery,
} from "./saved-views.js";
import type { TableDensity } from "./types.js";

export { fitViewTabs } from "@auction/ui/lax";
import { type TeamView, VIEW_LABEL_MAX_LENGTH, ViewsMenu } from "./views-menu.js";

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
        {end ? (
          <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0">{end}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Search within the list. Submits on Enter (and after a pause when `live`), so a server-filtered
 * list does not refetch on every key. Escape clears; `/` from anywhere on the page focuses it.
 */
export function TableSearch({
  value,
  onSearch,
  placeholder,
  label,
  live = false,
  fullWidth = false,
}: {
  value: string;
  onSearch: (query: string) => void;
  placeholder: string;
  label: string;
  live?: boolean;
  /** Fills the toolbar row (the ListPage layout) instead of a fixed 256px. */
  fullWidth?: boolean;
}) {
  const [text, setText] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setText(value), [value]);
  useStaffShortcut({
    id: "staff:focus-list-search",
    keys: "/",
    label: "Search this list",
    group: "Lists",
    handler: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  });
  React.useEffect(() => {
    if (!live || text === value) return;
    const timer = window.setTimeout(() => onSearch(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [live, text, value, onSearch]);
  return (
    <form
      aria-label={label}
      className={fullWidth ? "w-full min-w-0" : "w-full sm:w-64"}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <TextInput
        ref={inputRef}
        size="sm"
        type="search"
        aria-label={label}
        aria-keyshortcuts="/"
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

/** The chip for the search in force, worded the same on every list: "Search: ada". */
export function searchChipLabel(query: string): string {
  return `Search: ${query.trim()}`;
}

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
              // 20px to look at, 24px to hit: the pseudo-element widens the target.
              className="relative size-5 after:absolute after:-inset-0.5 [&_svg]:size-3"
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
        // Back at the list's own default, nothing is remembered, so a new default reaches people.
        if (next === initial) window.localStorage.removeItem(`staff.density.${storageKey}`);
        else window.localStorage.setItem(`staff.density.${storageKey}`, next);
      } catch {
        // Storage unavailable: the choice lasts for this page only.
      }
    },
    [storageKey, initial],
  );
  return [density, update] as const;
}

export type DataView = {
  id: string;
  label: string;
  href: string;
  count?: number;
};

/**
 * A list's views as tabs: each is a URL, so a view can be bookmarked or shared. The tabs are the
 * built-in views (with counts). The Views menu adds the team's fixed views and the person's own
 * saved views, which follow them across devices; "Save view" keeps the current search and
 * filters as one. When the list is showing a team or saved view it appears as the active tab.
 */
export function DataViews({
  views,
  activeId,
  Link,
  team = [],
  saved,
  savedHref,
  currentQuery,
}: {
  views: readonly DataView[];
  activeId: string | null;
  Link: LinkComponent;
  /** Views fixed in code for everyone; shown in the Views menu, never editable. */
  team?: readonly TeamView[];
  /** The person's own views (from `useSavedViews`); turns on saving and managing them. */
  saved?: SavedViewsControls;
  /** The list URL for one of the person's views. */
  savedHref?: (view: SavedView) => string;
  /** The list's current search and filters as URL params, empty when there are none. */
  currentQuery?: string;
}) {
  const [naming, setNaming] = React.useState<{ name: string; error?: string } | null>(null);
  const personal = saved?.views ?? [];
  const query = viewQuery(currentQuery ?? "");
  const savedMatch = query ? personal.find((view) => sameViewQuery(view.query, query)) : undefined;
  const teamMatch = query ? team.find((view) => sameViewQuery(view.query, query)) : undefined;
  const matched = savedMatch
    ? { id: savedMatch.id, label: savedMatch.label, href: savedHref?.(savedMatch) ?? "#" }
    : teamMatch
      ? { id: teamMatch.id, label: teamMatch.label, href: teamMatch.href }
      : null;
  const tabs: DataView[] = matched ? [...views, matched] : [...views];
  const currentId = matched?.id ?? activeId;

  const save = async (name: string) => {
    if (!saved) return;
    setNaming(null);
    const result = await saved.save(name, query);
    if (result.ok) toast.success(`Saved “${name}”`);
    else setNaming({ name, error: result.message });
  };

  return (
    <div className="flex items-center gap-1">
      <OverflowTabs tabs={tabs} currentId={currentId} Link={Link} label="Views" />
      {team.length > 0 || saved ? (
        <div className="flex shrink-0 items-center gap-1">
          {saved && query && !matched ? (
            <StaffButton
              variant="ghost"
              size="sm"
              icon={<Plus aria-hidden />}
              onClick={() => setNaming({ name: "" })}
              // On a phone the label hides so the view tabs keep their room; the name stays.
              className="text-staff-muted max-sm:gap-0 max-sm:px-2"
            >
              <span className="max-sm:sr-only">Save view</span>
            </StaffButton>
          ) : null}
          <ViewsMenu
            team={team}
            saved={saved}
            savedHref={savedHref}
            activeViewId={matched?.id ?? null}
            Link={Link}
          />
        </div>
      ) : null}
      {saved ? (
        <StaffDialog
          open={naming !== null}
          onOpenChange={(open) => {
            if (!open) setNaming(null);
          }}
          title="Save view"
          description="Keeps the current search and filters as a view you can open from any device."
          footer={
            <>
              <StaffButton variant="secondary" onClick={() => setNaming(null)}>
                Cancel
              </StaffButton>
              <StaffButton
                variant="primary"
                type="submit"
                form="staff-save-view"
                disabled={!naming?.name.trim()}
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
              const name = naming?.name.trim();
              if (name) void save(name);
            }}
          >
            <Field label="Name" error={naming?.error}>
              <TextInput
                autoFocus
                maxLength={VIEW_LABEL_MAX_LENGTH}
                value={naming?.name ?? ""}
                onChange={(event) => setNaming({ name: event.target.value })}
                placeholder="e.g. Paid this week"
              />
            </Field>
          </form>
        </StaffDialog>
      ) : null}
    </div>
  );
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
  Link: LinkComponent;
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
