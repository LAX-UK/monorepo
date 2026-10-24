import { UserSuspendAction, UserTwoFactorResetAction } from "@/components/admin/admin-user-actions";
import { DangerZone, DangerZoneAction } from "@auction/staff-ui";

type Props = {
  userId: string;
  suspendedAt: string | null;
  /** The reset only applies while the person has two-step verification turned on. */
  twoFactorEnabled?: boolean;
};

/**
 * Account-level actions that are hard to undo, at the foot of a person's page. Each action is
 * one row: what it does on the left, its button on the right.
 */
export function AdminUserDangerZone({ userId, suspendedAt, twoFactorEnabled = false }: Props) {
  return (
    <DangerZone>
      {twoFactorEnabled ? (
        <DangerZoneAction
          title="Reset two-step verification"
          description="For someone who has lost their authenticator app and backup codes. Check who they are first; they are signed out everywhere and emailed that support reset it."
          action={<UserTwoFactorResetAction userId={userId} />}
        />
      ) : null}
      <DangerZoneAction
        title={suspendedAt ? "Unsuspend account" : "Suspend account"}
        description={
          suspendedAt
            ? "Lets this person sign in and bid again."
            : "Blocks this person from signing in and taking actions on the platform."
        }
        action={<UserSuspendAction userId={userId} suspendedAt={suspendedAt} fullWidthButton />}
      />
    </DangerZone>
  );
}
