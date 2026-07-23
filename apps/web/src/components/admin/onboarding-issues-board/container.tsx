"use client";

import { AdminListPreviewDegradedAlert } from "@/components/admin/admin-list-preview-degraded-alert";
import { OnboardingIssuesBoard } from "@/components/admin/onboarding-issues-board/index";
import { buildOnboardingIssuesItemHref } from "@/lib/admin/onboarding-issues-list-href";
import type { AdminOnboardingIssueRow } from "@/lib/data/http/admin-onboarding-issues.shared";
import type {
  OnboardingQueueSummary,
  OnboardingTabId,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type OnboardingIssuesBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  tab: OnboardingTabId;
  rows: AdminOnboardingIssueRow[];
  selected?: AdminOnboardingIssueRow | null;
  selectedItemId?: string | undefined;
  summary: OnboardingQueueSummary;
  lensTotal: number;
  pagination?: OnboardingIssuesBoardPagination | null | undefined;
  tabHrefs: Record<OnboardingTabId, string>;
  listReturnTarget?: string | undefined;
  clearPreviewHref?: string | undefined;
  previewDegraded?: boolean;
};

export function OnboardingIssuesBoardContainer({
  tab,
  rows,
  selected: selectedProp,
  selectedItemId,
  summary,
  lensTotal,
  pagination,
  tabHrefs,
  listReturnTarget,
  clearPreviewHref,
  previewDegraded = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromRows = useMemo(
    () => (selectedItemId ? (rows.find((row) => row.id === selectedItemId) ?? null) : null),
    [rows, selectedItemId],
  );
  const selected = selectedProp ?? selectedFromRows;

  const onOpen = useCallback(
    (row: AdminOnboardingIssueRow) => {
      router.push(buildOnboardingIssuesItemHref(searchParams, row.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildOnboardingIssuesItemHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="space-y-4">
      {previewDegraded && clearPreviewHref ? (
        <AdminListPreviewDegradedAlert entityLabel="onboarding item" clearHref={clearPreviewHref} />
      ) : null}
      <OnboardingIssuesBoard
        tab={tab}
        rows={rows}
        selected={selected}
        summary={summary}
        lensTotal={lensTotal}
        onOpen={onOpen}
        onCloseDrawer={onCloseDrawer}
        tabHrefs={tabHrefs}
        buildItemHref={(itemId) => buildOnboardingIssuesItemHref(searchParams, itemId)}
        listReturnTarget={listReturnTarget}
        pagination={pagination ?? null}
      />
    </div>
  );
}
