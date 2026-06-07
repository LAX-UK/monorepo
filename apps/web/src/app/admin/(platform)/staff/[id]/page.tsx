import { AdminUserCapabilitiesPanel } from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { loadAdminStaffDetail } from "@/lib/admin/load-admin-staff-detail";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserStaffRole } from "@auction/types";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getAdminUserById(id).catch(() => null);
  const roleLabel = staffRoleLabel((user?.staffRole as UserStaffRole | null) ?? null);
  return metadataForPrivate(
    user?.name ?? "Staff member",
    user ? `${user.email} · ${roleLabel}` : "Staff detail",
  );
}

export default async function AdminStaffDetailPage({ params }: Props) {
  const { id } = await params;
  const { user } = await loadAdminStaffDetail(id);

  return (
    <AdminUserDetailShell
      user={user}
      listHref="/admin/staff"
      listLabel="Staff"
      showContextRail={false}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: <AdminUserProfilePanel user={user} />,
        },
        {
          id: "permissions",
          label: "Permissions",
          content: (
            <AdminUserCapabilitiesPanel
              staffRole={(user.staffRole as UserStaffRole | null) ?? null}
            />
          ),
        },
      ]}
    />
  );
}
