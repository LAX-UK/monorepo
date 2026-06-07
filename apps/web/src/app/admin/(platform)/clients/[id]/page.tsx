import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
import { AdminUserAmlPanel } from "@/components/admin/admin-user-aml-panel";
import {
  AdminUserLegalEntitiesPanel,
  AdminUserPaymentsPanel,
  AdminUserWonLotsPanel,
} from "@/components/admin/admin-user-commerce-panel";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { AdminUserKycHistoryPanel } from "@/components/admin/admin-user-kyc-history-panel";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import {
  getAdminArtistsByOwnerUserId,
  getAdminLegalEntitiesForUser,
  getAdminLotsWonByUser,
  getAdminPaymentsForUser,
  getAdminUserAmlScreenings,
  getAdminUserById,
  getAdminUserKycSessions,
} from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminClientDetailPage({ params }: Props) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getAdminUserById>> = null;
  try {
    user = await getAdminUserById(id);
  } catch {
    user = null;
  }
  if (!user) notFound();
  if (user.role === "staff") {
    redirect(`/admin/staff/${id}`);
  }

  const sessionUser = await getServerSessionUser();
  const canViewAml =
    sessionUser != null &&
    userHasAccessTo(sessionUser.role as UserRole, sessionUser.staffRole ?? null, AML_REVIEW_ACCESS);

  const [linkedArtists, payments, wonLots, legalEntities, kycSessions, amlScreenings] =
    await Promise.all([
      getAdminArtistsByOwnerUserId(user.id).catch(() => []),
      getAdminPaymentsForUser(user.id).catch(() => []),
      getAdminLotsWonByUser(user.id).catch(() => []),
      getAdminLegalEntitiesForUser(user.id).catch(() => []),
      getAdminUserKycSessions(user.id).catch(() => []),
      canViewAml ? getAdminUserAmlScreenings(user.id).catch(() => []) : Promise.resolve([]),
    ]);

  const lifetimeSpend = payments
    .filter((p) => p.status === "captured")
    .reduce((acc, p) => acc + Number.parseFloat(p.amount || "0"), 0);

  const submissionTotals = await Promise.all(
    legalEntities.map((entity) =>
      getAdminSubmissions({ sellerId: entity.id, limit: 1, offset: 0 })
        .then((r) => r.total)
        .catch(() => 0),
    ),
  );
  const submissionsCount = submissionTotals.reduce((a, b) => a + b, 0);

  const amlScreeningBySessionId = Object.fromEntries(
    amlScreenings.map((screening) => [screening.providerSessionId, screening]),
  );

  return (
    <AdminUserDetailShell
      user={user}
      listHref="/admin/clients"
      listLabel="Clients"
      summaryMetrics={{
        lifetimeSpend: lifetimeSpend > 0 ? lifetimeSpend : null,
        lotsWon: wonLots.length,
        submissionsCount: submissionsCount > 0 ? submissionsCount : null,
        memberSinceIso: user.createdAt,
      }}
      legalEntitiesForActions={legalEntities.map((e) => ({
        id: e.id,
        displayName: e.displayName,
      }))}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-8">
              <AdminUserProfilePanel user={user} />
              <AdminUserKycHistoryPanel
                sessions={kycSessions}
                currentKycSessionId={user.currentKycSessionId}
                amlScreeningBySessionId={amlScreeningBySessionId}
              />
              {canViewAml ? <AdminUserAmlPanel screenings={amlScreenings} /> : null}
              <AdminClientArtistProfilesPanel
                userId={user.id}
                userName={user.name}
                linkedArtists={linkedArtists}
              />
              <AdminUserLegalEntitiesPanel legalEntities={legalEntities} />
            </div>
          ),
        },
        {
          id: "bids",
          label: "Won lots",
          content: <AdminUserWonLotsPanel wonLots={wonLots} />,
        },
        {
          id: "payouts",
          label: "Payments",
          content: <AdminUserPaymentsPanel payments={payments} />,
        },
      ]}
    />
  );
}
