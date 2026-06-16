import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
import {
  AdminDetailTabAttentionBadge,
  AdminDetailTabCountBadge,
} from "@/components/admin/admin-detail-tab-badges";
import { AdminUserAmlPanel } from "@/components/admin/admin-user-aml-panel";
import {
  AdminUserBidsPanel,
  AdminUserLegalEntitiesPanel,
  AdminUserPaymentsPanel,
  AdminUserWonLotsPanel,
} from "@/components/admin/admin-user-commerce-panel";
import { AdminUserKycHistoryPanel } from "@/components/admin/admin-user-kyc-history-panel";
import {
  type AdminUserOverviewSection,
  AdminUserOverviewSections,
} from "@/components/admin/admin-user-overview-sections";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { AdminUserReadinessPanel } from "@/components/admin/admin-user-readiness-panel";
import { AdminUserSofPanel } from "@/components/admin/admin-user-sof-panel";
import type { AdminClientDetailBundle } from "@/lib/admin/load-admin-client-detail";
import type { ReactNode } from "react";

export type AdminClientDetailTab = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: ReactNode;
};

function buildOverviewSections(bundle: AdminClientDetailBundle): AdminUserOverviewSection[] {
  const {
    user,
    linkedArtists,
    legalEntities,
    kycSessions,
    amlScreenings,
    canViewAml,
    canViewKyc,
    amlScreeningBySessionId,
    readinessSnapshot,
    sofCases,
    canViewSof,
  } = bundle;

  return [
    {
      id: "readiness",
      label: "Readiness",
      content: <AdminUserReadinessPanel snapshot={readinessSnapshot} />,
    },
    {
      id: "profile",
      label: "Profile",
      content: <AdminUserProfilePanel user={user} />,
    },
    ...(canViewKyc
      ? [
          {
            id: "kyc-history",
            label: "KYC",
            content: (
              <AdminUserKycHistoryPanel
                sessions={kycSessions}
                currentKycSessionId={user.currentKycSessionId}
                amlScreeningBySessionId={amlScreeningBySessionId}
              />
            ),
          } satisfies AdminUserOverviewSection,
        ]
      : []),
    ...(canViewAml
      ? [
          {
            id: "aml",
            label: "AML",
            content: <AdminUserAmlPanel screenings={amlScreenings} />,
          } satisfies AdminUserOverviewSection,
        ]
      : []),
    ...(canViewSof
      ? [
          {
            id: "sof",
            label: "SoF",
            content: <AdminUserSofPanel cases={sofCases} />,
          } satisfies AdminUserOverviewSection,
        ]
      : []),
    {
      id: "artist-profiles",
      label: "Artists",
      content: (
        <AdminClientArtistProfilesPanel
          userId={user.id}
          userName={user.name}
          linkedArtists={linkedArtists}
        />
      ),
    },
    {
      id: "legal-entities",
      label: "Entities",
      content: <AdminUserLegalEntitiesPanel legalEntities={legalEntities} />,
    },
  ];
}

/** Declarative tab definitions for the admin client detail page (OCP extension point). */
export function buildAdminClientDetailTabs(
  bundle: AdminClientDetailBundle,
): AdminClientDetailTab[] {
  const { payments, wonLots, bids, attentionItems, canViewFinance, canViewBids } = bundle;
  const overviewSections = buildOverviewSections(bundle);

  const tabs: AdminClientDetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      badge: attentionItems.length > 0 ? <AdminDetailTabAttentionBadge /> : undefined,
      content: <AdminUserOverviewSections sections={overviewSections} />,
    },
    {
      id: "won-lots",
      label: "Won lots",
      badge: <AdminDetailTabCountBadge count={wonLots.length} />,
      content: <AdminUserWonLotsPanel wonLots={wonLots} />,
    },
  ];

  if (canViewBids) {
    tabs.push({
      id: "bids",
      label: "Bids",
      badge: <AdminDetailTabCountBadge count={bids.length} />,
      content: <AdminUserBidsPanel bids={bids} />,
    });
  }

  if (canViewFinance) {
    tabs.push({
      id: "payments",
      label: "Payments",
      badge: <AdminDetailTabCountBadge count={payments.length} />,
      content: <AdminUserPaymentsPanel payments={payments} />,
    });
  }

  return tabs;
}
