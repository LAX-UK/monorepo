"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Rows3,
  Rows4,
  Search,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "../forms/field.js";
import { cn } from "../lib/cn.js";
import { StaffDialog } from "../panels/staff-dialog.js";
import { StaffButton } from "../primitives/button.js";
import { TextInput } from "../primitives/input.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import { Count, SegmentedControl } from "../primitives/tabs.js";
import type { StaffLinkComponent } from "../shell/link.js";
import { useStaffShortcut } from "../shell/shortcuts.js";
import {
  type SavedView,
  type SavedViewsControls,
  sameViewQuery,
  viewQuery,
} from "./saved-views.js";
import type { TableDensity } from "./types.js";
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
        {end ? <div className="ml-auto flex items-center gap-2">{end}</div> : null}
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
  Link: StaffLinkComponent;
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
      <ViewTabs tabs={tabs} currentId={currentId} Link={Link} />
      {team.length > 0 || saved ? (
        <div className="flex shrink-0 items-center gap-1">
          {saved && query && !matched ? (
            <StaffButton
              variant="ghost"
              size="sm"
              icon={<Plus aria-hidden />}
              onClick={() => setNaming({ name: "" })}
              className="text-staff-muted"
            >
              Save view
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

const tabClass = (active: boolean) =>
  cn(
    "staff-focus relative flex h-10 shrink-0 items-center gap-1.5 rounded-staff-xs px-2.5 text-staff-sm font-medium whitespace-nowrap transition-colors",
    "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
    active ? "text-staff-fg after:bg-staff-ink" : "text-staff-muted hover:text-staff-fg",
  );

/** Room kept for the "More" button when some tabs do not fit. */
const MORE_WIDTH = 88;

/**
 * Which tabs fit on one line. The active tab always stays visible, taking the place of the last
 * one that fits; the rest go into "More". Before the first measurement (and where nothing can be
 * measured) every tab shows.
 */
export function fitViewTabs(
  widths: readonly number[],
  available: number,
  activeIndex: number,
  gap = 2,
): { visible: number[]; overflow: number[] } {
  const all = widths.map((_, index) => index);
  const total = widths.reduce((sum, width) => sum + width + gap, 0);
  if (available <= 0 || total <= available) return { visible: all, overflow: [] };
  const room = available - MORE_WIDTH;
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
 * The built-in views as tabs on one line, in sentence case. When they do not fit, the ones that
 * do not go into a "More" menu instead of scrolling out of sight.
 */
function ViewTabs({
  tabs,
  currentId,
  Link,
}: {
  tabs: readonly DataView[];
  currentId: string | null;
  Link: StaffLinkComponent;
}) {
  const navRef = React.useRef<HTMLElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const activeIndex = tabs.findIndex((tab) => tab.id === currentId);
  const signature = `${tabs.map((tab) => `${tab.id}:${tab.label}:${tab.count ?? ""}`).join("|")}#${activeIndex}`;
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
      const next = fitViewTabs(widths.current.values, nav.clientWidth, activeIndex);
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
  }, [signature]);

  const visible = current?.visible ?? tabs.map((_, index) => index);
  const overflow = current?.overflow ?? [];

  const content = (view: DataView) => (
    <>
      {view.label}
      {view.count !== undefined ? <Count value={view.count} /> : null}
    </>
  );

  return (
    <nav aria-label="Views" ref={navRef} className="min-w-0 flex-1 overflow-hidden">
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
          <li>
            <StaffMenu>
              <StaffMenuTrigger asChild>
                <StaffButton
                  variant="ghost"
                  size="sm"
                  className="text-staff-muted"
                  aria-label={`More views, ${overflow.length}`}
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
