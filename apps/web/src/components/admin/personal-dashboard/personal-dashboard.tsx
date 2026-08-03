import { OperationalContextSection } from "@/components/admin/personal-dashboard/operational-context-section";
import type { AssignmentFilter } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import { WorkInboxWidget } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-widget";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { getDashboardProfile } from "@/lib/admin/dashboard-profile-registry";
import {
  type DashboardWidgetState,
  isDashboardWidgetVisible,
} from "@/lib/admin/dashboard-widgets.vm";
import type { RecentActivitySlice } from "@/lib/admin/dashboard/recent-activity.slice";
import type { SaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import type { WorkInboxSlice } from "@/lib/admin/dashboard/work-inbox.slice";
import type { UserStaffRole } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  actorUserId: string;
  widgets: readonly DashboardWidgetState[];
  staffRole?: UserStaffRole | null;
  activeLotIds: readonly string[];
  workAssignment?: AssignmentFilter;
  workInbox: WorkInboxSlice;
  saleReadiness: SaleReadinessSlice;
  recentActivity: RecentActivitySlice;
};

function SliceUnavailable({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Surface variant="section" padding="md" className="border-border-hairline">
      <DashboardEmptyState variant="quiet" title={title} description={message} headingLevel="h3" />
    </Surface>
  );
}

export function PersonalDashboard({
  actorUserId,
  widgets,
  staffRole = null,
  activeLotIds,
  workAssignment = "all",
  workInbox,
  saleReadiness,
  recentActivity,
}: Props) {
  const show = (id: DashboardWidgetState["id"]) => isDashboardWidgetVisible(widgets, id);
  const profile = getDashboardProfile(staffRole);

  const activityRows =
    recentActivity.status === "ready" || recentActivity.status === "empty"
      ? recentActivity.data.rows
      : [];

  const showOperations = show("saleroom-live") || show("onsite-radar");
  const showActivity = show("activity");
  const showContext = showOperations || showActivity;

  return (
    <div className="space-y-10">
      {show("my-queue") ? (
        workInbox.status === "unavailable" ? (
          <SliceUnavailable title="Work inbox unavailable" message={workInbox.message} />
        ) : (
          <WorkInboxWidget
            workInbox={workInbox}
            actorUserId={actorUserId}
            queueDomains={profile.queueDomains}
            initialAssignment={workAssignment}
          />
        )
      ) : null}

      {showContext ? (
        <OperationalContextSection
          showOperations={showOperations}
          showActivity={showActivity}
          saleReadiness={saleReadiness}
          recentActivity={recentActivity}
          activeLotIds={activeLotIds}
          activityRows={activityRows}
        />
      ) : null}
    </div>
  );
}
