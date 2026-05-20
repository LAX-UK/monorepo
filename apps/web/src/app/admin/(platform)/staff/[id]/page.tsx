import { AdminUserCapabilitiesPanel } from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminStaffDetailPage({ params }: Props) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getAdminUserById>> = null;
  try {
    user = await getAdminUserById(id);
  } catch {
    user = null;
  }
  if (!user) notFound();
  if (user.role !== "staff") {
    redirect(`/admin/clients/${id}`);
  }

  const notesPlaceholder = (
    <p className="font-body text-sm text-on-surface-variant">
      Internal notes & tags require user_note / user_tag migrations before collaborative workflows
      unlock.
    </p>
  );

  return (
    <AdminUserDetailShell
      user={user}
      listHref="/admin/staff"
      listLabel="Staff"
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
        {
          id: "notes",
          label: "Notes",
          content: notesPlaceholder,
        },
      ]}
    />
  );
}
