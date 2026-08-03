"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { WorkInboxCards } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-cards";
import {
  WorkInboxFiltersSheet,
  activeFilterSummary,
} from "@/components/admin/personal-dashboard/work-inbox/work-inbox-filters-sheet";
import { WorkInboxRowActions } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-row-actions";
import { WorkInboxTable } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-table";
import type { AssignmentFilter } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import {
  domainOptions,
  entityId,
  filterWorkInboxItems,
  itemSupportsAssignment,
} from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { executeWorkItemActionAction } from "@/lib/actions/admin/admin-work-item-actions";
import type { AttentionDomain } from "@/lib/admin/admin-home-types";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";
import type { WorkInboxSlice } from "@/lib/admin/dashboard/work-inbox.slice";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type {
  AdminWorkItem,
  AdminWorkItemAction,
  AdminWorkItemDomain,
} from "@/lib/data/http/admin-work-items.schema";
import { notify } from "@/lib/ui/notify";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { Sheet, SheetContent } from "@auction/ui/components/sheet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

function useMinLg(): boolean {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isLg;
}

const ACTION_LABELS: Record<AdminWorkItemAction, string> = {
  start_review: "Start review",
  approve: "Approve",
  reject: "Reject",
  assign_to_me: "Assign to me",
  mark_in_progress: "Claim",
  decline: "Decline",
  capture: "Capture",
  refund: "Refund",
  approve_registration: "Approve registration",
  reject_registration: "Reject registration",
  confirm_telephone: "Confirm booking",
  assign_clerk: "Assign clerk",
  release_fulfilment: "Release",
  ready_for_collection: "Ready for collection",
  delivered: "Mark delivered",
};

type Props = {
  workInbox: WorkInboxSlice;
  actorUserId: string;
  queueDomains: readonly AttentionDomain[];
  initialAssignment: AssignmentFilter;
};

export function WorkInboxWidget({
  workInbox,
  actorUserId,
  queueDomains,
  initialAssignment,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLg = useMinLg();
  const [previewItem, setPreviewItem] = useState<AdminWorkItem | null>(null);
  const [domainFilter, setDomainFilter] = useState<AdminWorkItemDomain | "all">("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(initialAssignment);
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const [bulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    setAssignmentFilter(initialAssignment);
  }, [initialAssignment]);

  const onOpenPreview = useCallback((item: AdminWorkItem) => {
    setPreviewItem(item);
  }, []);

  const allItems =
    workInbox.status === "ready" || workInbox.status === "empty" ? workInbox.data.items : [];
  const domainCounts =
    workInbox.status === "ready" || workInbox.status === "empty"
      ? workInbox.data.counts.byDomain
      : {
          finance: 0,
          compliance: 0,
          catalogue: 0,
          saleroom: 0,
          fulfilment: 0,
          clients: 0,
        };

  const domains = useMemo(
    () => domainOptions(queueDomains, domainCounts),
    [queueDomains, domainCounts],
  );

  const items = filterWorkInboxItems(allItems, domainFilter, "all", actorUserId);
  const changeAssignment = (assignment: AssignmentFilter) => {
    setAssignmentFilter(assignment);
    const params = new URLSearchParams(searchParams.toString());
    if (assignment === "all") params.delete("assignment");
    else params.set("assignment", assignment);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const urgentCount = items.filter(
    (item) => item.severity === "critical" || item.severity === "high",
  ).length;
  const hasActiveFilters = domainFilter !== "all" || assignmentFilter !== "all";
  const filterSummary = activeFilterSummary(assignmentFilter, domainFilter);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const sharedBulkAction = useMemo((): AdminWorkItemAction | null => {
    if (selectedItems.length === 0) return null;
    const first = selectedItems[0]?.actions ?? [];
    return (
      first.find((action) => selectedItems.every((item) => item.actions.includes(action))) ?? null
    );
  }, [selectedItems]);

  const bulkOperations = useMemo((): BulkOperation[] => {
    if (!sharedBulkAction) return [];
    const destructive = sharedBulkAction === "reject" || sharedBulkAction === "refund";
    return [
      {
        id: sharedBulkAction,
        label: ACTION_LABELS[sharedBulkAction],
        destructive,
        run: async (ids) => {
          startBulkTransition(async () => {
            let failures = 0;
            for (const id of ids) {
              const item = selectedItems.find((row) => row.id === id);
              if (!item) continue;
              const result = await executeWorkItemActionAction({
                itemId: item.id,
                kind: item.kind,
                action: sharedBulkAction,
                saleId: item.saleId ?? undefined,
                registrationId: item.kind === "sale_registration" ? entityId(item) : undefined,
                bookingId: item.kind === "telephone_booking" ? entityId(item) : undefined,
              });
              if (!result.ok) failures += 1;
            }
            if (failures === 0) {
              notify.success(`Bulk ${ACTION_LABELS[sharedBulkAction].toLowerCase()} completed`);
              clear();
              router.refresh();
            } else {
              notify.error(`${failures} item${failures === 1 ? "" : "s"} failed`);
            }
          });
          return { ok: true as const };
        },
      },
    ];
  }, [sharedBulkAction, selectedItems, clear, router]);

  const domainChipItems = useMemo(
    () => [
      { id: "all" as const, label: "All" },
      ...domains.map((domain) => ({
        id: domain,
        label: `${domain} (${domainCounts[domain] ?? 0})`,
      })),
    ],
    [domains, domainCounts],
  );

  const previewBody = previewItem ? (
    <div className="flex h-full flex-col gap-4">
      <AdminPreviewSheetHeader
        title={previewItem.title}
        subtitle={previewItem.subtitle ?? undefined}
        fullPageHref={previewItem.href}
      />
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-on-surface-variant">Domain:</span> {previewItem.domain}
        </p>
        <p>
          <span className="text-on-surface-variant">Severity:</span> {previewItem.severity}
        </p>
        {previewItem.assignedToUserId ? (
          <p>
            <span className="text-on-surface-variant">Assigned:</span>{" "}
            {previewItem.assignedToUserId === actorUserId ? "You" : previewItem.assignedToUserId}
          </p>
        ) : itemSupportsAssignment(previewItem) ? (
          <p className="text-on-surface-variant">Unassigned</p>
        ) : null}
      </div>
      <WorkInboxRowActions item={previewItem} layout="drawer" />
    </div>
  ) : null;

  const clearFilters = () => {
    setDomainFilter("all");
    changeAssignment("all");
  };

  const panel = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-shell-stroke px-4 py-5 sm:px-6">
        <div>
          <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface">
            Work inbox
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {items.length} item{items.length === 1 ? "" : "s"}
            {urgentCount > 0 ? (
              <>
                {" "}
                · <span className="text-warning">{urgentCount} need attention</span>
              </>
            ) : null}
          </p>
        </div>
        <WorkInboxFiltersSheet
          assignmentFilter={assignmentFilter}
          onAssignmentChange={changeAssignment}
          domainFilter={domainFilter}
          onDomainChange={setDomainFilter}
          domainChipItems={domainChipItems}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      </div>

      {filterSummary.length > 0 ? (
        <div className="border-b border-shell-stroke px-4 py-2 sm:px-6">
          <p className="font-body text-xs text-on-surface-variant">
            Filtered by {filterSummary.join(", ")}
          </p>
        </div>
      ) : null}

      <div className="px-4 py-2 sm:px-6">
        {workInbox.status === "empty" ? (
          <div className="py-8">
            <AdminEmptyState
              context="completion"
              title="All clear"
              description={workInbox.message ?? "No individual work items need action right now."}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8">
            <FilterEmptyState
              entity="work items"
              segment="admin"
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          </div>
        ) : (
          <>
            <WorkInboxTable
              items={items}
              actorUserId={actorUserId}
              onOpenPreview={onOpenPreview}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
            <WorkInboxCards items={items} actorUserId={actorUserId} onOpenPreview={onOpenPreview} />
          </>
        )}
      </div>
    </>
  );

  if (workInbox.status === "empty") {
    return (
      <section className="overflow-hidden rounded-xl border border-shell-stroke bg-surface-container-lowest">
        {panel}
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-shell-stroke bg-surface-container-lowest">
        {panel}
      </section>

      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={bulkOperations}
        onClear={clear}
        pageRowCount={items.length}
        onSelectAllOnPage={() => selectAllOnPage(items.map((item) => item.id))}
        preflightWarning={
          selectedIds.length > 0 && !sharedBulkAction && !bulkPending
            ? "Selected items do not share a common action."
            : null
        }
      />

      {isLg ? (
        <Sheet open={previewItem != null} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            {previewBody}
          </SheetContent>
        </Sheet>
      ) : (
        <BottomSheet
          open={previewItem != null}
          onOpenChange={(open) => !open && setPreviewItem(null)}
        >
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle>{previewItem?.title ?? "Work item"}</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="px-4 pb-6">{previewBody}</div>
          </BottomSheetContent>
        </BottomSheet>
      )}
    </>
  );
}
