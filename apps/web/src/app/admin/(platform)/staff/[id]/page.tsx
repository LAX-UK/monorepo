import { AdminUserActivityPanel } from "@/components/admin/admin-user-activity-panel";
import { AdminUserCapabilitiesPanel } from "@/components/admin/admin-user-capabilities-panel";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { AdminUserProfilePanel } from "@/components/admin/admin-user-profile-panel";
import {
  getAdminDomainEvents,
  getAdminUserActivity,
  getAdminUserById,
} from "@/lib/data/http/admin.server";
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

  const [sessions, domainEvents] = await Promise.all([
    getAdminUserActivity(user.id).catch(() => []),
    getAdminDomainEvents({ aggregateType: "user", aggregateId: user.id, limit: 50 }).catch(
      () => [],
    ),
  ]);

  return (
    <AdminUserDetailShell
      user={user}
      listHref="/admin/staff"
      listLabel="Staff"
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
          id: "capabilities",
          label: "Capabilities",
          content: (
            <AdminUserCapabilitiesPanel
              staffRole={(user.staffRole as UserStaffRole | null) ?? null}
            />
          ),
        },
        {
          id: "notes",
          label: "Notes",
          content: (
            <p className="font-body text-sm text-on-surface-variant">
              Internal notes & tags require user_note / user_tag migrations before collaborative
              workflows unlock.
            </p>
          ),
        },
      ]}
    />
  );
}
