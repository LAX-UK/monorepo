import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { ConsignmentTabs } from "@/components/dashboard/seller/consignment-tabs";
import { ConsignmentsList } from "@/components/dashboard/seller/consignments-list";
import { SubmissionsListAutoRefresh } from "@/components/dashboard/submissions/submissions-list-auto-refresh";
import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  requireSellerCapability,
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { CONSIGNMENT_STAGE_LABEL } from "@/lib/organisation-home/consignment-stage-links";
import type { ItemSubmission, Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  CONSIGNMENT_TABS,
  buildConsignmentRows,
  consignmentTabLabel,
  countConsignmentsByTab,
  filterConsignmentRows,
  parseConsignmentFilter,
} from "./consignments.vm";

const PATH = "/selling/consignments";
/** Each source is read in one page; the notice below says so when a source fills it. */
const PAGE_LIMIT = 100;

type PageProps = {
  searchParams: Promise<{ tab?: string; status?: string; stage?: string }>;
};

export default async function SellerConsignmentsPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  requireSellerCapability(sellerCtx, "entity.consignments.read");
  const { sellerEntityId, bootstrapFailed } = sellerCtx;
  const canCreateSubmission = sellerCan(sellerCtx, "entity.submissions.create");
  const { tab, reviewStage } = parseConsignmentFilter(await searchParams);

  const c = await getServerDataContainer();
  const [submissionsResult, lotsResult] = await Promise.allSettled([
    c.submissions.listMine({ limit: PAGE_LIMIT, offset: 0 }),
    sellerEntityId
      ? c.sellerLots.list({ sellerId: sellerEntityId, limit: PAGE_LIMIT })
      : Promise.resolve([] as Lot[]),
  ]);

  const failures: DashboardSliceFailure[] = [];
  let submissions: ItemSubmission[] = [];
  let lots: Lot[] = [];
  if (submissionsResult.status === "fulfilled") {
    submissions = submissionsResult.value;
  } else {
    failures.push(submissionsFailureFromCaught(submissionsResult.reason));
  }
  if (lotsResult.status === "fulfilled") {
    lots = lotsResult.value;
  } else {
    failures.push(
      describeDashboardSliceFailure(lotsResult.reason, "sellerLots", "Could not load your lots."),
    );
  }

  const rows = buildConsignmentRows({ submissions, lots });
  const counts = countConsignmentsByTab(rows);
  const visible = filterConsignmentRows(rows, tab, reviewStage);
  const reviewStageLabel = reviewStage ? CONSIGNMENT_STAGE_LABEL[reviewStage] : null;
  const truncated = submissions.length >= PAGE_LIMIT || lots.length >= PAGE_LIMIT;
  const loadedNothing = failures.length === 2;

  const tabItems = CONSIGNMENT_TABS.map((id) => ({
    id,
    label: consignmentTabLabel(id),
    count: counts[id],
    href: id === "all" ? PATH : `${PATH}?tab=${id}`,
    active: id === tab,
  }));

  return (
    <DashboardListPage
      title="Consignments"
      description="Everything you have handed to LAX, from first submission through sale."
      actions={
        canCreateSubmission ? (
          <Button variant="primary" asChild>
            <Link href={DASHBOARD_ROUTES.submissionsNew}>
              <Plus className="size-4" aria-hidden />
              {DASHBOARD_CTA.newSubmission}
            </Link>
          </Button>
        ) : null
      }
      banner={
        !sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null
      }
      errorAlert={failures.map((failure) => (
        <DashboardSliceErrorAlert key={failure.title} failure={failure} />
      ))}
    >
      {loadedNothing ? null : (
        <>
          <SubmissionsListAutoRefresh enabled={counts["in-review"] > 0} />
          <ConsignmentTabs tabs={tabItems} />
          {reviewStage && reviewStageLabel ? (
            <CatalogActiveFilterChips
              className="mb-0 md:mb-0"
              chips={[
                { key: reviewStage, label: reviewStageLabel, removeHref: `${PATH}?tab=in-review` },
              ]}
            />
          ) : null}
          {rows.length === 0 ? (
            <DashboardEmptyState
              variant="hero"
              illustration="easel"
              title={DASHBOARD_EMPTY.consignments.title}
              description={DASHBOARD_EMPTY.consignments.description}
              {...(canCreateSubmission
                ? {
                    action: (
                      <Button variant="primary" asChild>
                        <Link href={DASHBOARD_ROUTES.submissionsNew}>
                          {DASHBOARD_CTA.newSubmission}
                        </Link>
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : visible.length === 0 ? (
            <DashboardEmptyState
              title={
                reviewStageLabel
                  ? `Nothing ${reviewStageLabel.toLowerCase()}`
                  : `Nothing in ${consignmentTabLabel(tab).toLowerCase()}`
              }
              description="Nothing has reached this stage yet."
              action={
                <Button variant="secondaryOutline" asChild>
                  <Link href={PATH}>Show all consignments</Link>
                </Button>
              }
            />
          ) : (
            <ConsignmentsList rows={visible} />
          )}
          {truncated ? (
            <p className="font-body text-xs text-on-surface-variant">
              Showing your {PAGE_LIMIT} most recent items from each list.
            </p>
          ) : null}
        </>
      )}
    </DashboardListPage>
  );
}
