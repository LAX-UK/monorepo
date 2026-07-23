"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminQueueCountBadge, AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import {
  artistColumns,
  docColumns,
  entityColumns,
  kycColumns,
  kycUserLabel,
  orgColumns,
} from "@/components/admin/onboarding-issues-board/columns";
import type { OnboardingIssuesBoardPagination } from "@/components/admin/onboarding-issues-board/container";
import { OnboardingIssueDrawerContent } from "@/components/admin/onboarding-issues-board/drawer";
import { OnboardingIssuesTable } from "@/components/admin/onboarding-issues-board/issues-table";
import { adminDetailTabsStickyTop } from "@/lib/admin/admin-sticky-layout";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import type { AdminOnboardingIssueRow } from "@/lib/data/http/admin-onboarding-issues.shared";
import {
  ONBOARDING_TAB_IDS,
  type OnboardingQueueSummary,
  type OnboardingTabId,
  onboardingTabCount,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";
import { formatDateTime } from "@/lib/ui/format";
import { Sheet, SheetContent, cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const TAB_LABELS: Record<OnboardingTabId, string> = {
  entities: "Entities",
  artists: "Artists",
  kyc: "KYC sessions",
  orgs: "Lead orgs",
  documents: "Documents",
};

type Props = {
  tab: OnboardingTabId;
  rows: AdminOnboardingIssueRow[];
  selected?: AdminOnboardingIssueRow | null;
  summary: OnboardingQueueSummary;
  lensTotal: number;
  onOpen: (row: AdminOnboardingIssueRow) => void;
  onCloseDrawer: () => void;
  buildTabHref: (tab: OnboardingTabId) => string;
  buildItemHref: (itemId: string) => string;
  listReturnTarget?: string | undefined;
  pagination?: OnboardingIssuesBoardPagination | null;
};

function columnsForTab(tab: OnboardingTabId): ColumnDef<AdminOnboardingIssueRow>[] {
  switch (tab) {
    case "entities":
      return entityColumns() as ColumnDef<AdminOnboardingIssueRow>[];
    case "artists":
      return artistColumns() as ColumnDef<AdminOnboardingIssueRow>[];
    case "kyc":
      return kycColumns() as ColumnDef<AdminOnboardingIssueRow>[];
    case "orgs":
      return orgColumns() as ColumnDef<AdminOnboardingIssueRow>[];
    case "documents":
      return docColumns() as ColumnDef<AdminOnboardingIssueRow>[];
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

function rowDisplayName(row: AdminOnboardingIssueRow): string {
  if ("entityDisplayName" in row) return row.entityDisplayName;
  if ("displayName" in row) return row.displayName;
  if ("userId" in row) return kycUserLabel(row);
  return "Onboarding issue";
}

function drawerFullPageHref(
  tab: OnboardingTabId,
  row: AdminOnboardingIssueRow,
  listReturnTarget?: string,
): string | undefined {
  switch (tab) {
    case "entities":
    case "orgs":
      return buildPeopleDetailHref(`/admin/legal-entities/${row.id}`, listReturnTarget);
    case "artists":
      return `/admin/artists/${row.id}/edit`;
    case "kyc":
      return "userId" in row
        ? buildPeopleDetailHref(
            `/admin/clients/${encodeURIComponent(row.userId)}`,
            listReturnTarget,
          )
        : undefined;
    case "documents":
      return "legalEntityId" in row
        ? buildPeopleDetailHref(
            `/admin/legal-entities/${row.legalEntityId}?tab=documents`,
            listReturnTarget,
          )
        : undefined;
    default:
      return undefined;
  }
}

function renderMobileCard(
  tab: OnboardingTabId,
  row: AdminOnboardingIssueRow,
  onOpen: Props["onOpen"],
) {
  switch (tab) {
    case "entities":
      return "status" in row && "displayName" in row ? (
        <>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-left font-medium"
            onClick={() => onOpen(row)}
          >
            <p className="font-medium">{row.displayName}</p>
          </Button>
          <div className="mt-1">
            {"status" in row ? <AdminStatusBadge domain="legalEntity" status={row.status} /> : null}
          </div>
          <Link
            href={`/admin/legal-entities/${row.id}`}
            className="mt-2 inline-block text-sm text-link underline"
          >
            Open
          </Link>
        </>
      ) : null;
    case "artists":
      return "displayName" in row && !("userId" in row) ? (
        <>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-left font-medium"
            onClick={() => onOpen(row)}
          >
            <p className="font-medium">{row.displayName}</p>
          </Button>
          <Link
            href={`/admin/artists/${row.id}/edit`}
            className="mt-2 inline-block text-sm text-link underline"
          >
            Review
          </Link>
        </>
      ) : null;
    case "kyc":
      return "userId" in row ? (
        <>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-left font-medium"
            onClick={() => onOpen(row)}
          >
            <p className="font-medium">{kycUserLabel(row)}</p>
          </Button>
          <p className="mt-1 text-xs text-on-surface-variant">{row.provider}</p>
          <div className="mt-1">
            <AdminStatusBadge domain="kyc" status={row.status} />
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(row.createdAt)}</p>
          <Link
            href={`/admin/clients/${encodeURIComponent(row.userId)}`}
            className="mt-2 inline-block text-sm text-link underline"
          >
            Open client
          </Link>
        </>
      ) : null;
    case "orgs":
      return "createdAt" in row && "displayName" in row && !("userId" in row) ? (
        <>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-left font-medium"
            onClick={() => onOpen(row)}
          >
            <p className="font-medium">{row.displayName}</p>
          </Button>
          <p className="mt-1 text-xs text-on-surface-variant">
            Created {new Date(row.createdAt).toLocaleDateString("en-GB")}
          </p>
          <Link
            href={`/admin/legal-entities/${row.id}`}
            className="mt-2 inline-block text-sm text-link underline"
          >
            Open entity
          </Link>
        </>
      ) : null;
    case "documents":
      return "legalEntityId" in row ? (
        <>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-left font-medium"
            onClick={() => onOpen(row)}
          >
            <p className="font-medium">{row.entityDisplayName}</p>
          </Button>
          <p className="mt-1 text-xs text-on-surface-variant">Document awaiting review</p>
          <Link
            href={`/admin/legal-entities/${row.legalEntityId}?tab=documents`}
            className="mt-2 inline-block text-sm text-link underline"
          >
            Review documents
          </Link>
        </>
      ) : null;
    default:
      return null;
  }
}

export function OnboardingIssuesBoard({
  tab,
  rows,
  selected = null,
  summary,
  lensTotal,
  onOpen,
  onCloseDrawer,
  buildTabHref,
  buildItemHref,
  listReturnTarget,
  pagination = null,
}: Props) {
  const columns = useMemo(() => columnsForTab(tab), [tab]);
  const selectedIndex = selected ? rows.findIndex((row) => row.id === selected.id) : -1;
  const prevRow = selectedIndex > 0 ? rows[selectedIndex - 1] : null;
  const nextRow =
    selectedIndex >= 0 && selectedIndex < rows.length - 1 ? rows[selectedIndex + 1] : null;

  if (summary.queueTotal === 0) {
    return (
      <AdminEmptyState
        title="All onboarding issues resolved"
        description="New legal entities, artists, stale verification sessions, lead organisations, and documents will appear here when they need staff review."
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div
          className={cn(
            "sticky z-10 -mx-1 border-b border-border-hairline bg-page-bg/95 px-1 pb-0 backdrop-blur-sm",
            adminDetailTabsStickyTop({ detailHeaderSticky: false }),
          )}
        >
          <div
            className={cn(
              "mb-0 flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0",
              "snap-x snap-mandatory scrollbar-thin",
            )}
            role="tablist"
            aria-label="Onboarding issue queues"
          >
            {ONBOARDING_TAB_IDS.map((tabId) => {
              const count = onboardingTabCount(summary, tabId);
              const active = tabId === tab;
              return (
                <Link
                  key={tabId}
                  href={buildTabHref(tabId)}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "shrink-0 snap-start rounded-none border-b-2 px-3 py-2.5",
                    "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                    active
                      ? "border-accent-brand text-on-surface"
                      : "border-transparent text-on-surface-variant",
                  )}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {TAB_LABELS[tabId]}
                    {count > 0 ? <AdminQueueCountBadge count={count} /> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
          )}
        >
          <CatalogBoardTableHeader
            leading={
              <>
                <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                  {TAB_LABELS[tab]}
                </h2>
                <Badge
                  variant="secondary"
                  className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
                >
                  {lensTotal}
                </Badge>
              </>
            }
          />
          <div className="p-4 sm:p-6">
            {rows.length === 0 ? (
              <AdminEmptyState
                title={`No ${TAB_LABELS[tab].toLowerCase()} on this page.`}
                description="Try another tab or adjust pagination."
              />
            ) : (
              <OnboardingIssuesTable
                rows={rows}
                columns={columns}
                emptyTitle={`No ${TAB_LABELS[tab].toLowerCase()}.`}
                getRowHref={(row) => buildItemHref(row.id)}
                renderCard={(row) => renderMobileCard(tab, row, onOpen)}
              />
            )}
          </div>
          {pagination ? (
            <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
              <CatalogPagination {...pagination} />
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && onCloseDrawer()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              {(() => {
                const fullPageHref = drawerFullPageHref(tab, selected, listReturnTarget);
                return (
                  <AdminPreviewSheetHeader
                    title={rowDisplayName(selected)}
                    {...(fullPageHref ? { fullPageHref } : {})}
                  />
                );
              })()}
              {selectedIndex >= 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {prevRow ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={buildItemHref(prevRow.id)}>
                        <ChevronLeft className="size-4" aria-hidden />
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled>
                      <ChevronLeft className="size-4" aria-hidden />
                      Previous
                    </Button>
                  )}
                  <span className="px-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                    {selectedIndex + 1 + (pagination?.offset ?? 0)} of {lensTotal}
                  </span>
                  {nextRow ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={buildItemHref(nextRow.id)}>
                        Next
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled>
                      Next
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              ) : null}
              <OnboardingIssueDrawerContent tab={tab} row={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
