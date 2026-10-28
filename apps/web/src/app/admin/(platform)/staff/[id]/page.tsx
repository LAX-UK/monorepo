import { AdminUserCapabilitiesPanel } from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { PeopleDetailShell } from "@/components/admin/people-detail-shell";
import { StaffLaxAccessPanel } from "@/components/admin/people/staff-lax-access-panel";
import {
  LaxAdminRolesSection,
  StaffRolesSection,
} from "@/components/admin/people/staff-roles-section";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { loadAdminStaffDetail } from "@/lib/admin/load-admin-staff-detail";
import { staffRolesLabel } from "@/lib/admin/staff-role-presenter";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { getServerStaffAccessDetail } from "@/lib/data/http/staff-access.server";
import { getServerLaxAdminRoles, getServerStaffRoles } from "@/lib/data/http/staff-roles.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { normalizeStaffRoles } from "@auction/types";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getAdminUserById(id).catch(() => null);
  return metadataForPrivate(
    user?.name ?? "Staff member",
    user
      ? `${user.email} · ${staffRolesLabel(normalizeStaffRoles(user.staffRoles))}`
      : "Staff detail",
  );
}

export default async function AdminStaffDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listHref = parseAdminListReturnTarget(sp.returnTo, "/admin/staff");
  const [{ user, canManageRoles, canModerate }, accessDetail, roles, laxAdminRoles] =
    await Promise.all([
      loadAdminStaffDetail(id),
      getServerStaffAccessDetail(id).catch(() => null),
      getServerStaffRoles(id).catch(() => null),
      getServerLaxAdminRoles(id).catch(() => null),
    ]);
  const nowIso = new Date().toISOString();
  const person = { id: user.id, name: user.name?.trim() || user.email };

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
              <StaffRolesSection person={person} overview={roles} nowIso={nowIso} />
              <LaxAdminRolesSection person={person} overview={laxAdminRoles} nowIso={nowIso} />
              <StaffLaxAccessPanel detail={accessDetail} />
              <AdminUserCapabilitiesPanel staffRoles={normalizeStaffRoles(user.staffRoles)} />
            </>
          ),
        },
      ]}
    />
  );
}
