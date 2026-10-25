import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
import { AdminUserAmlPanel } from "@/components/admin/admin-user-aml-panel";
import {
  AdminUserBidsPanel,
  AdminUserLegalEntitiesPanel,
  AdminUserPaymentsPanel,
  AdminUserWonLotsPanel,
} from "@/components/admin/admin-user-commerce-panel";
import { AdminUserKycHistoryPanel } from "@/components/admin/admin-user-kyc-history-panel";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { AdminUserSofPanel } from "@/components/admin/admin-user-sof-panel";
import type { PeopleDetailTab } from "@/components/admin/people-detail-shell";
import type { AdminClientDetailBundle } from "@/lib/admin/load-admin-client-detail";
import { buildClientOverviewStats } from "@/lib/data/view-models/people-overview.vm";
import { StatGrid } from "@auction/staff-ui";

export type AdminClientDetailTab = PeopleDetailTab;

function overviewTab(bundle: AdminClientDetailBundle): PeopleDetailTab {
  const { user, payments, summaryMetrics } = bundle;
  return {
    id: "overview",
    label: "Overview",
    content: (
      <>
        <StatGrid
          label="Client summary"
          items={buildClientOverviewStats({ summaryMetrics, payments })}
        />
        <AdminUserProfilePanel user={user} />
        {bundle.canViewKyc ? (
          <AdminUserKycHistoryPanel
            sessions={bundle.kycSessions}
            currentKycSessionId={user.currentKycSessionId}
            amlScreeningBySessionId={bundle.amlScreeningBySessionId}
          />
        ) : null}
        {bundle.canViewAml ? <AdminUserAmlPanel screenings={bundle.amlScreenings} /> : null}
        {bundle.canViewSof ? <AdminUserSofPanel cases={bundle.sofCases} /> : null}
        <AdminClientArtistProfilesPanel
          userId={user.id}
          userName={user.name}
          linkedArtists={bundle.linkedArtists}
          canCreate={bundle.canWriteArtists}
        />
        <AdminUserLegalEntitiesPanel legalEntities={bundle.legalEntities} />
      </>
    ),
  };
}

/**
 * The tabs of a client's page: an overview, and the heavier lists (won lots, bids, payments)
 * each on its own `?tab=` URL, left out when the viewer's role cannot see them.
 */
export function buildAdminClientDetailTabs(bundle: AdminClientDetailBundle): PeopleDetailTab[] {
  const tabs: PeopleDetailTab[] = [
    overviewTab(bundle),
    {
      id: "won-lots",
      label: "Won lots",
      count: bundle.wonLots.length,
      content: <AdminUserWonLotsPanel wonLots={bundle.wonLots} />,
    },
  ];

  if (bundle.canViewBids) {
    tabs.push({
      id: "bids",
      label: "Bids",
      count: bundle.bidsTotal,
      content: (
        <AdminUserBidsPanel
          bids={bundle.bids}
          total={bundle.bidsTotal}
          clientLabel={bundle.user.name}
        />
      ),
    });
  }

  if (bundle.canViewFinance) {
    tabs.push({
      id: "payments",
      label: "Payments",
      count: bundle.payments.length,
      content: <AdminUserPaymentsPanel payments={bundle.payments} />,
    });
  }

  return tabs;
}
