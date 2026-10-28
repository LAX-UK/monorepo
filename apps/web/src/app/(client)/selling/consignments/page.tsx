import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { ConsignmentTabs } from "@/components/dashboard/seller/consignment-tabs";
import { ConsignmentsList } from "@/components/dashboard/seller/consignments-list";
import { NeedsYouCard } from "@/components/dashboard/seller/needs-you-card";
import { SellWithLaxInvitation } from "@/components/dashboard/seller/sell-with-lax-invitation";
import { SellingSectionTabs } from "@/components/dashboard/seller/selling-section-tabs";
import { SubmissionsListAutoRefresh } from "@/components/dashboard/submissions/submissions-list-auto-refresh";
import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  ACCOUNT_LOAD_ERROR,
  DASHBOARD_CTA,
  DASHBOARD_EMPTY,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard/dashboard-copy";
import {
  requireSellerCapability,
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { CONSIGNMENT_STAGE_LABEL } from "@/lib/organisation-home/consignment-stage-links";
import {
  CONSIGNMENT_TABS,
  consignmentTabLabel,
  countConsignmentsByTab,
  filterConsignmentRows,
  parseConsignmentFilter,
} from "@/lib/seller/consignments.vm";
import { SELLING_PAGE_LIMIT, loadSellingOverview } from "@/lib/seller/selling-overview.server";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const PATH = "/selling/consignments";

export const metadata: Metadata = { title: "Consignments" };

type PageProps = {
  searchParams: Promise<{ tab?: string; status?: string; stage?: string }>;
};

/**
 * Consignments. A person sees it as Selling's first page: what needs them, then their works. An
 * organisation sees it in its workspace with status filters, since it consigns many works.
 */
export default async function SellerConsignmentsPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  requireSellerCapability(sellerCtx, "entity.consignments.read");
  const { sellerEntityId, bootstrapFailed, sellingAsOrganisation } = sellerCtx;
  const canCreateSubmission = sellerCan(sellerCtx, "entity.submissions.create");
  const [overview, filter] = await Promise.all([
    loadSellingOverview(sellerCtx, user.id),
    searchParams.then(parseConsignmentFilter),
  ]);
  const { rows } = overview;
  const counts = countConsignmentsByTab(rows);

  const action = canCreateSubmission ? (
    <Button variant="primary" size="default" asChild>
      <Link href={DASHBOARD_ROUTES.submissionsNew}>
        <Plus aria-hidden />
        {DASHBOARD_CTA.submitWork}
      </Link>
    </Button>
  ) : null;
  const banner = !sellerEntityId ? (
    <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} />
  ) : null;
  const partialFailures = overview.loadedNothing
    ? null
    : overview.failures.map((failure) => (
        <DashboardSliceErrorAlert key={failure.title} failure={failure} />
      ));

  if (!sellingAsOrganisation) {
    return (
      <DashboardListPage
        title="Selling"
        description="Works you've offered to LAX, from specialist review to payout."
        actions={rows.length > 0 ? action : null}
        banner={banner}
        tabs={<SellingSectionTabs current="consignments" />}
        errorAlert={partialFailures}
      >
        {overview.loadedNothing ? (
          <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignments} />
        ) : (
          <div className="flex flex-col gap-8">
            <SubmissionsListAutoRefresh enabled={counts["in-review"] > 0} />
            {overview.needsYou ? <NeedsYouCard vm={overview.needsYou} /> : null}
            {rows.length === 0 ? (
              <SellWithLaxInvitation />
            ) : (
              <section aria-labelledby="consignments-heading" className="flex flex-col gap-4">
                <h2
                  id="consignments-heading"
                  className="font-headline text-lg font-semibold text-on-surface"
                >
                  Consignments
                </h2>
                <ConsignmentsList rows={rows} />
                {overview.truncated ? (
                  <p className="font-body text-xs text-on-surface-variant">
                    Showing your {SELLING_PAGE_LIMIT} most recent works.
                  </p>
                ) : null}
              </section>
            )}
          </div>
        )}
      </DashboardListPage>
    );
  }

  const { tab, reviewStage } = filter;
  const visible = filterConsignmentRows(rows, tab, reviewStage);
  const reviewStageLabel = reviewStage ? CONSIGNMENT_STAGE_LABEL[reviewStage] : null;
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
      description="Everything handed to LAX, from first submission through sale."
      actions={action}
      banner={banner}
      errorAlert={partialFailures}
    >
      {overview.loadedNothing ? (
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignments} />
      ) : (
        <>
          <SubmissionsListAutoRefresh enabled={counts["in-review"] > 0} />
          {/* The stage chip belongs to the tabs it narrows, so it sits right under them. */}
          <div className="space-y-3">
            <ConsignmentTabs tabs={tabItems} />
            {reviewStage && reviewStageLabel ? (
              <CatalogActiveFilterChips
                className="mb-0 md:mb-0"
                chips={[
                  {
                    key: reviewStage,
                    label: reviewStageLabel,
                    removeHref: `${PATH}?tab=in-review`,
                  },
                ]}
              />
            ) : null}
          </div>
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
                          {DASHBOARD_CTA.submitWork}
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
          {overview.truncated ? (
            <p className="font-body text-xs text-on-surface-variant">
              Showing the {SELLING_PAGE_LIMIT} most recent items from each list.
            </p>
          ) : null}
        </>
      )}
    </DashboardListPage>
  );
}
