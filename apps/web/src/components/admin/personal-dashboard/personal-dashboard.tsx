"use client";

import { CustomisePanel } from "@/components/admin/personal-dashboard/customise-panel";
import { MetricsPeriodMenu } from "@/components/admin/personal-dashboard/metrics-period-menu";
import {
  RecentActivitySection,
  SalesSection,
} from "@/components/admin/personal-dashboard/overview-context-sections";
import { WorkInbox } from "@/components/admin/personal-dashboard/work-inbox/work-inbox";
import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import {
  type DashboardWidgetState,
  isDashboardWidgetVisible,
} from "@/lib/admin/dashboard-widgets.vm";
import type { SaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import type { WorkInboxSlice } from "@/lib/admin/dashboard/work-inbox.slice";
import type { WorkArea, WorkAssignment } from "@/lib/admin/dashboard/work-inbox.vm";
import type { AdminWorkItemDomain } from "@/lib/data/http/admin-work-items.schema";
import {
  type AttentionItem,
  AttentionList,
  type Metric,
  MetricStrip,
  Notice,
  PageHeader,
  Section,
  StaffButton,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import type { StaffRoles } from "@auction/types";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

export type PersonalDashboardProps = {
  title: string;
  actorUserId: string;
  staffRoles: StaffRoles | undefined;
  widgets: readonly DashboardWidgetState[];
  /** The role's usual next step, the page's one primary action. */
  primaryAction: { href: string; label: string };
  /** A second, quieter link beside it. */
  quickLink?: { href: string; label: string } | null;
  /** Some data could not load; what did loads. */
  loadWarning?: string | null;
  workInbox: WorkInboxSlice;
  /** Client messages waiting; the card is left out when there are none. */
  inboxQueues?: readonly AttentionItem[];
  workAreas: readonly AdminWorkItemDomain[];
  area: WorkArea;
  assignment: WorkAssignment;
  openItemId?: string | null;
  periodDays: AdminKpiPeriodDays;
  /** The role's numbers; empty when the role has none. */
  metrics: readonly Metric[];
  metricsPeriod: string;
  saleReadiness: SaleReadinessSlice;
  activeLotIds: readonly string[];
  activity: readonly AdminActivityRow[];
  activityUnavailable?: string | null;
};

/**
 * Bid admin's Overview, a work inbox first: the work waiting on this person, then their role's
 * numbers with trends, then the saleroom and upcoming sales beside the latest lot activity. Each
 * block can be hidden from Customise.
 */
export function PersonalDashboard(props: PersonalDashboardProps) {
  const show = (id: DashboardWidgetState["id"]) => isDashboardWidgetVisible(props.widgets, id);
  const inbox = props.workInbox;
  const showPulse = show("saleroom-live");
  const showSales = show("onsite-radar");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={props.title}
        description="The work waiting on you, then the numbers and what changed."
        primaryAction={
          <StaffButton asChild variant="primary">
            <Link href={props.primaryAction.href}>{props.primaryAction.label}</Link>
          </StaffButton>
        }
        secondaryActions={
          <>
            {props.quickLink ? (
              <StaffButton asChild>
                <Link href={props.quickLink.href}>{props.quickLink.label}</Link>
              </StaffButton>
            ) : null}
            <CustomisePanel widgets={props.widgets} staffRoles={props.staffRoles} />
          </>
        }
      />

      {props.loadWarning ? (
        <Notice tone="warning" title="Some of Overview could not load">
          {props.loadWarning}
        </Notice>
      ) : null}

      {props.inboxQueues && props.inboxQueues.length > 0 ? (
        <AttentionList title="Client messages" items={props.inboxQueues} Link={NextLink} />
      ) : null}

      {show("my-queue") ? (
        inbox.status === "unavailable" ? (
          <Section title="Your work">
            <Notice tone="warning" title="Your work could not load">
              {inbox.message}
            </Notice>
          </Section>
        ) : (
          <WorkInbox
            items={inbox.data.items}
            counts={inbox.data.counts}
            areas={props.workAreas}
            area={props.area}
            assignment={props.assignment}
            period={props.periodDays === 30 ? undefined : String(props.periodDays)}
            openItemId={props.openItemId ?? null}
            actorUserId={props.actorUserId}
            emptyMessage={inbox.status === "empty" ? inbox.message : null}
          />
        )
      ) : null}

      {show("kpi-band") && props.metrics.length > 0 ? (
        <MetricStrip
          label="Your numbers"
          period={props.metricsPeriod}
          action={<MetricsPeriodMenu current={props.periodDays} />}
          items={props.metrics}
          Link={NextLink}
        />
      ) : null}

      {showPulse || showSales || show("activity") ? (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {showPulse || showSales ? (
            <div className="flex min-w-0 flex-col gap-6">
              <SalesSection
                saleReadiness={props.saleReadiness}
                activeLotIds={props.activeLotIds}
                showPulse={showPulse}
                showSales={showSales}
              />
            </div>
          ) : null}
          {show("activity") ? (
            <div className="min-w-0">
              <RecentActivitySection
                rows={props.activity}
                unavailable={props.activityUnavailable ?? null}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
