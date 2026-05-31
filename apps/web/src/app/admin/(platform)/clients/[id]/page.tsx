import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
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
  getAdminUserById,
  getAdminUserKycSessions,
} from "@/lib/data/http/admin.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
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

  const [linkedArtists, payments, wonLots, legalEntities, kycSessions] = await Promise.all([
    getAdminArtistsByOwnerUserId(user.id).catch(() => []),
    getAdminPaymentsForUser(user.id).catch(() => []),
    getAdminLotsWonByUser(user.id).catch(() => []),
    getAdminLegalEntitiesForUser(user.id).catch(() => []),
    getAdminUserKycSessions(user.id).catch(() => []),
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

  const notesPlaceholder = (
    <p className="font-body text-sm text-on-surface-variant">
      Internal notes & tags require user_note / user_tag migrations before collaborative workflows
      unlock.
    </p>
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
              <AdminUserKycHistoryPanel sessions={kycSessions} />
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
          label: "Bids",
          content: <AdminUserWonLotsPanel wonLots={wonLots} />,
        },
        {
          id: "payouts",
          label: "Payouts",
          content: <AdminUserPaymentsPanel payments={payments} />,
        },
        {
          id: "notes",
          label: "Notes",
          content: notesPlaceholder,
        },
      ]}
    />
  );
}
