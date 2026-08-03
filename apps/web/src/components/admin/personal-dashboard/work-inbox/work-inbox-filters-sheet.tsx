"use client";

import type { AssignmentFilter } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import type { AdminWorkItemDomain } from "@/lib/data/http/admin-work-items.schema";
import { Button } from "@auction/ui/components/button";
import { FilterChipGroup } from "@auction/ui/components/filter-chip-group";
import { SegmentToggle } from "@auction/ui/components/segment-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { SlidersHorizontal } from "lucide-react";

type Props = {
  assignmentFilter: AssignmentFilter;
  onAssignmentChange: (value: AssignmentFilter) => void;
  domainFilter: AdminWorkItemDomain | "all";
  onDomainChange: (value: AdminWorkItemDomain | "all") => void;
  domainChipItems: readonly { id: AdminWorkItemDomain | "all"; label: string }[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

export function WorkInboxFiltersSheet({
  assignmentFilter,
  onAssignmentChange,
  domainFilter,
  onDomainChange,
  domainChipItems,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-9 gap-2">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {hasActiveFilters ? (
            <span className="size-1.5 rounded-full bg-primary" aria-label="Filters active" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Inbox filters</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <p className="font-body text-sm font-medium text-on-surface">Assignment</p>
            <SegmentToggle
              aria-label="Filter work inbox by assignment"
              value={assignmentFilter}
              onValueChange={onAssignmentChange}
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Mine" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
            <p className="font-body text-xs text-on-surface-variant">
              Applies to submissions and review tasks only.
            </p>
          </div>
          <div className="space-y-3">
            <p className="font-body text-sm font-medium text-on-surface">Domain</p>
            <FilterChipGroup
              aria-label="Filter work inbox by domain"
              value={domainFilter}
              onChange={onDomainChange}
              items={domainChipItems}
            />
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function activeFilterSummary(
  assignmentFilter: AssignmentFilter,
  domainFilter: AdminWorkItemDomain | "all",
): string[] {
  const parts: string[] = [];
  if (assignmentFilter === "mine") parts.push("Mine");
  if (assignmentFilter === "unassigned") parts.push("Unassigned");
  if (domainFilter !== "all") parts.push(domainFilter);
  return parts;
}
