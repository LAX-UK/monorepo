import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { UserSuspendAction, UserTwoFactorResetAction } from "@/components/admin/admin-user-actions";

type Props = {
  userId: string;
  suspendedAt: string | null;
  /** The reset only applies while the person has two-step verification turned on. */
  twoFactorEnabled?: boolean;
};

export function AdminUserDangerZone({ userId, suspendedAt, twoFactorEnabled = false }: Props) {
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
      {twoFactorEnabled ? (
        <div className="mt-4 space-y-2">
          <p className="font-body text-sm text-on-surface-variant">
            If this person has lost their authenticator app and backup codes, reset two-step
            verification so they can sign in again. Check who they are first.
          </p>
          <UserTwoFactorResetAction userId={userId} fullWidthButton />
        </div>
      ) : null}
    </section>
  );
}
