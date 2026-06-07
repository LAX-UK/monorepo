import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { UserSuspendAction } from "@/components/admin/admin-user-actions";

type Props = {
  userId: string;
  suspendedAt: string | null;
};

export function AdminUserDangerZone({ userId, suspendedAt }: Props) {
  return (
    <section
      aria-labelledby="user-danger-zone-title"
      className="rounded-xl border border-error/40 bg-error/5 p-5"
    >
      <AdminSectionLabel id="user-danger-zone-title" as="h2" className="text-error">
        Danger zone
      </AdminSectionLabel>
      <p className="mt-2 font-body text-sm text-on-surface-variant">
        Suspending blocks this user from signing in and taking actions on the platform.
      </p>
      <div className="mt-4">
        <UserSuspendAction userId={userId} suspendedAt={suspendedAt} fullWidthButton />
      </div>
    </section>
  );
}
