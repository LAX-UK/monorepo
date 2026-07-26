import { AdminUserAccountControls } from "@/components/admin/admin-user-account-controls";
import {
  AdminUserCapabilitiesPanel,
  STAFF_OVERVIEW_SECTION_COUNT,
  countStaffCapabilities,
} from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { PeopleDetailShell } from "@/components/admin/people-detail-shell";
import { PeopleOverviewTab } from "@/components/admin/people/people-overview-tab";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { loadAdminStaffDetail } from "@/lib/admin/load-admin-staff-detail";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { buildPeopleOverviewViewModel } from "@/lib/data/view-models/people-overview.vm";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole, UserStaffRole } from "@auction/types";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getAdminUserById(id).catch(() => null);
  const roleLabel = staffRoleLabel((user?.staffRole as UserStaffRole | null) ?? null);
  return metadataForPrivate(
    user?.name ?? "Staff member",
    user ? `${user.email} · ${roleLabel}` : "Staff detail",
  );
}

export default async function AdminStaffDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listHref = parseAdminListReturnTarget(sp.returnTo, "/admin/staff");
  const { user, canManageRoles, canModerate } = await loadAdminStaffDetail(id);
  const staffRole = (user.staffRole as UserStaffRole | null) ?? null;
  const permissionsCount = countStaffCapabilities(staffRole);
  const overviewVm = buildPeopleOverviewViewModel({
    summaryMetrics: {
      memberSinceIso: user.createdAt,
      lifetimeSpend: null,
      lotsWon: null,
      submissionsCount: null,
    },
    isStaff: true,
  });

  return (
    <PeopleDetailShell
      user={user}
      listHref={listHref}
      listLabel="Staff"
      showContextRail={false}
      showAccountControls={canManageRoles}
      showDangerZone={canModerate}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          count: STAFF_OVERVIEW_SECTION_COUNT,
          content: (
            <PeopleOverviewTab kpiTiles={overviewVm.kpiTiles} ariaLabel="Staff summary">
              <AdminUserProfilePanel user={user} />
            </PeopleOverviewTab>
          ),
        },
        {
          id: "permissions",
          label: "Permissions",
          count: permissionsCount,
          content: (
            <div className="space-y-6">
              {canManageRoles ? (
                <AdminUserAccountControls
                  userId={user.id}
                  role={user.role as UserRole}
                  staffRole={staffRole}
                  isStaff
                />
              ) : null}
              <AdminUserCapabilitiesPanel staffRole={staffRole} />
            </div>
          ),
        },
      ]}
    />
  );
}
