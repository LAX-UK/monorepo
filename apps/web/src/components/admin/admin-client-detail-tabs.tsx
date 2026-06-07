import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
import {
  AdminDetailTabAttentionBadge,
  AdminDetailTabCountBadge,
} from "@/components/admin/admin-detail-tab-badges";
import { AdminUserAmlPanel } from "@/components/admin/admin-user-aml-panel";
import {
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
    amlScreeningBySessionId,
    readinessSnapshot,
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
    },
    ...(canViewAml
      ? [
          {
            id: "aml",
            label: "AML",
            content: <AdminUserAmlPanel screenings={amlScreenings} />,
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
  const { payments, wonLots, attentionItems } = bundle;
  const overviewSections = buildOverviewSections(bundle);

  return [
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
    {
      id: "payments",
      label: "Payments",
      badge: <AdminDetailTabCountBadge count={payments.length} />,
      content: <AdminUserPaymentsPanel payments={payments} />,
    },
  ];
}
