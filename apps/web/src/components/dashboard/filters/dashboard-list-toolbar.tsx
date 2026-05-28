"use client";

import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { MoreHorizontal, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export type DashboardSortSelectProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  /** Hide visible label on small screens; trigger keeps aria-label. */
  compactOnMobile?: boolean;
};

/** Compact sort dropdown for list toolbars. */
export function DashboardSortSelect({
  label,
  value,
  options,
  onValueChange,
  className,
  triggerClassName,
  compactOnMobile = false,
}: DashboardSortSelectProps) {
  return (
    <div className={cn("shrink-0 space-y-2", compactOnMobile && "max-md:space-y-0", className)}>
      <label
        htmlFor={`sort-${label.replace(/\s+/g, "-").toLowerCase()}`}
        className={cn(
          "block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary",
          compactOnMobile && "max-md:sr-only",
        )}
      >
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={`sort-${label.replace(/\s+/g, "-").toLowerCase()}`}
          className={cn(
            "min-h-11 w-[min(100%,12rem)] bg-surface-container-low",
            compactOnMobile && "max-md:w-[min(100%,9rem)]",
            triggerClassName,
          )}
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type DashboardFilterTriggerProps = {
  activeCount: number;
  onClick?: () => void;
  className?: string;
};

/** Filters button with active-count badge for mobile/sheet triggers. */
export function DashboardFilterTrigger({
  activeCount,
  onClick,
  className,
}: DashboardFilterTriggerProps) {
  return (
    <Button
      type="button"
      variant="secondaryOutline"
      className={cn("relative min-h-11 shrink-0 gap-2 px-4", className)}
      onClick={onClick}
      aria-label={activeCount > 0 ? `Filters, ${activeCount} applied` : "Filters"}
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      Filters
      {activeCount > 0 ? (
        <Badge
          variant="default"
          className="ml-0.5 min-h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums"
        >
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );
}

export type DashboardListToolbarProps = {
  search?: ReactNode;
  primaryFilters?: ReactNode;
  sort?: ReactNode;
  /** Desktop-only filter sheet (e.g. categories when many options). */
  filterSheet?: ReactNode;
  /** Mobile-only filter sheet — primary chips collapse here on small screens. */
  mobileFilterSheet?: ReactNode;
  /** Show primary filter chips on mobile (default: false when mobileFilterSheet is set). */
  showPrimaryOnMobile?: boolean;
  /** Hide sort control on mobile (move sort into mobileFilterSheet). */
  hideSortOnMobile?: boolean;
  /** Accessible label for the mobile actions overflow menu. */
  actionsOverflowLabel?: string;
  actions?: ReactNode;
  className?: string;
  searchLabel?: string;
};

const TOOLBAR_CARD_CLASS =
  "rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-sm ring-1 ring-outline-variant/10";

/** Unified dashboard list filter toolbar — search, chips, sort, and filter sheet. */
export function DashboardListToolbar({
  search,
  primaryFilters,
  sort,
  filterSheet,
  mobileFilterSheet,
  showPrimaryOnMobile,
  hideSortOnMobile = false,
  actions,
  actionsOverflowLabel = "More actions",
  className,
  searchLabel = "Filter list",
}: DashboardListToolbarProps) {
  const hidePrimaryOnMobile =
    showPrimaryOnMobile === false || (showPrimaryOnMobile !== true && Boolean(mobileFilterSheet));

  const sortControl =
    sort && hideSortOnMobile ? (
      <div className="hidden shrink-0 lg:block">{sort}</div>
    ) : sort ? (
      <div className="shrink-0">{sort}</div>
    ) : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className={TOOLBAR_CARD_CLASS}>
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-end gap-2 md:items-center md:gap-3">
            {search ? (
              <search
                className="min-w-0 flex-1 max-md:[&_.space-y-2]:space-y-0 max-md:[&_label]:sr-only md:max-w-md"
                aria-label={searchLabel}
              >
                {search}
              </search>
            ) : null}
            {mobileFilterSheet ? (
              <div className="shrink-0 lg:hidden">{mobileFilterSheet}</div>
            ) : null}
            {sortControl}
            {primaryFilters ? (
              <div
                className={cn(
                  "min-w-0 flex-1",
                  (hidePrimaryOnMobile || showPrimaryOnMobile) && "hidden lg:block",
                )}
              >
                {primaryFilters}
              </div>
            ) : null}
            {filterSheet ? <div className="hidden shrink-0 lg:block">{filterSheet}</div> : null}
            {actions ? (
              <div className="ml-auto hidden shrink-0 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
                {actions}
              </div>
            ) : null}
            {actions ? (
              <div className="shrink-0 lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="secondaryOutline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      aria-label={actionsOverflowLabel}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="flex min-w-[12rem] flex-col gap-1 p-2"
                  >
                    {actions}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
          {showPrimaryOnMobile && primaryFilters ? (
            <div className="lg:hidden">{primaryFilters}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
