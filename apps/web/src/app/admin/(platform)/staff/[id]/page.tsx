import { AdminUserCapabilitiesPanel } from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { PeopleDetailShell } from "@/components/admin/people-detail-shell";
import { StaffLaxAccessPanel } from "@/components/admin/people/staff-lax-access-panel";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { loadAdminStaffDetail } from "@/lib/admin/load-admin-staff-detail";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { getServerStaffAccessDetail } from "@/lib/data/http/staff-access.server";
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
  const [{ user, canManageRoles, canModerate }, accessDetail] = await Promise.all([
    loadAdminStaffDetail(id),
    getServerStaffAccessDetail(id).catch(() => null),
  ]);
  const staffRole = (user.staffRole as UserStaffRole | null) ?? null;

  return (
    <PeopleDetailShell
      user={user}
      listHref={listHref}
      listLabel="Staff"
      access={{ canModerate, canManageRoles }}
      showContextRail={false}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <>
              <AdminUserProfilePanel user={user} />
              <StaffLaxAccessPanel
                person={{
                  id: user.id,
                  name: user.name,
                  role: user.role as UserRole,
                  staffRole,
                  suspended: Boolean(user.suspendedAt),
                  twoFactorEnabled: user.twoFactorEnabled,
                }}
                detail={accessDetail}
                canManage={canManageRoles}
              />
              <AdminUserCapabilitiesPanel staffRole={staffRole} />
            </>
          ),
        },
      ]}
    />
  );
}
