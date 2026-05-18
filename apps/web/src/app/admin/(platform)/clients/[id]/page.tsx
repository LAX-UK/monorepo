import { AdminClientArtistProfilesPanel } from "@/components/admin/admin-client-artist-profiles-panel";
import {
  AdminUserActivityPanel,
  AdminUserAuditLogPanel,
} from "@/components/admin/admin-user-activity-panel";
import { AdminUserCommercePanel } from "@/components/admin/admin-user-commerce-panel";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import {
  getAdminArtistsByOwnerUserId,
  getAdminDomainEvents,
  getAdminLegalEntitiesForUser,
  getAdminLotsWonByUser,
  getAdminPaymentsForUser,
  getAdminUserActivity,
  getAdminUserById,
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

  const [linkedArtists, sessions, domainEvents, payments, wonLots, legalEntities] =
    await Promise.all([
      getAdminArtistsByOwnerUserId(user.id).catch(() => []),
      getAdminUserActivity(user.id).catch(() => []),
      getAdminDomainEvents({ aggregateType: "user", aggregateId: user.id, limit: 50 }).catch(
        () => [],
      ),
      getAdminPaymentsForUser(user.id).catch(() => []),
      getAdminLotsWonByUser(user.id).catch(() => []),
      getAdminLegalEntitiesForUser(user.id).catch(() => []),
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
          id: "profile",
          label: "Profile",
          content: <AdminUserProfilePanel user={user} />,
        },
        {
          id: "activity",
          label: "Activity",
          content: <AdminUserActivityPanel sessions={sessions} domainEvents={domainEvents} />,
        },
        {
          id: "commerce",
          label: "Commerce",
          content: (
            <AdminUserCommercePanel
              payments={payments}
              wonLots={wonLots}
              legalEntities={legalEntities}
            />
          ),
        },
        {
          id: "notes",
          label: "Audit log",
          content: <AdminUserAuditLogPanel sessions={sessions} domainEvents={domainEvents} />,
        },
        {
          id: "artists",
          label: "Artist profiles",
          content: (
            <AdminClientArtistProfilesPanel
              userId={user.id}
              userName={user.name}
              linkedArtists={linkedArtists}
            />
          ),
        },
      ]}
    />
  );
}
