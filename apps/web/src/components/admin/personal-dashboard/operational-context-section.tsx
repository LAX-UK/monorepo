"use client";

import { RecentActivityWidget } from "@/components/admin/personal-dashboard/recent-activity-widget";
import {
  SaleReadinessContextList,
  saleReadinessAttentionSummary,
} from "@/components/admin/personal-dashboard/sale-readiness-context-list";
import type { RecentActivitySlice } from "@/lib/admin/dashboard/recent-activity.slice";
import type { SaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type Props = {
  showOperations: boolean;
  showActivity: boolean;
  saleReadiness: SaleReadinessSlice;
  recentActivity: RecentActivitySlice;
  activeLotIds: readonly string[];
  activityRows: readonly import("@/lib/admin/admin-home-types").AdminActivityRow[];
};

function ContextSection({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-b border-shell-stroke last:border-b-0"
    >
      <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left">
        <div>
          <p className="font-body text-sm font-medium text-on-surface">{title}</p>
          {summary && !open ? (
            <p className="mt-0.5 font-body text-xs text-on-surface-variant">{summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function OperationalContextSection({
  showOperations,
  showActivity,
  saleReadiness,
  recentActivity,
  activeLotIds,
  activityRows,
}: Props) {
  const operationsSummary = useMemo(
    () => saleReadinessAttentionSummary(saleReadiness),
    [saleReadiness],
  );
  const activitySummary =
    recentActivity.status === "ready" && activityRows.length > 0
      ? `${activityRows.length} recent update${activityRows.length === 1 ? "" : "s"}`
      : recentActivity.status === "empty"
        ? "No recent activity"
        : null;

  if (!showOperations && !showActivity) return null;

  return (
    <section className="rounded-xl border border-shell-stroke bg-surface-container-lowest px-4 sm:px-6">
      <div className="border-b border-shell-stroke py-4">
        <h2 className="font-headline text-base font-semibold text-on-surface">
          Operational context
        </h2>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          Live operations and recent catalogue movement
        </p>
      </div>

      {showOperations ? (
        <ContextSection
          title="Saleroom and sale readiness"
          summary={operationsSummary}
          defaultOpen={Boolean(operationsSummary)}
        >
          <SaleReadinessContextList saleReadiness={saleReadiness} activeLotIds={activeLotIds} />
        </ContextSection>
      ) : null}

      {showActivity ? (
        <ContextSection title="Recent activity" summary={activitySummary}>
          {recentActivity.status === "unavailable" ? (
            <p className="font-body text-sm text-on-surface-variant">{recentActivity.message}</p>
          ) : recentActivity.status === "empty" ? (
            <p className="font-body text-sm text-on-surface-variant">
              {recentActivity.message ?? "No recent catalogue activity to show yet."}
            </p>
          ) : (
            <RecentActivityWidget activity={activityRows} embedded />
          )}
        </ContextSection>
      ) : null}
    </section>
  );
}
