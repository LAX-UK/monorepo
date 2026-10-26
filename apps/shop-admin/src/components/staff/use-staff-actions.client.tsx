"use client";

import { StaffRolePicker } from "@/components/staff/staff-role-picker.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { grantStaffRole, revokeStaffRole } from "@/server/application/admin-people-actions.server";
import {
  type GrantableStaffRole,
  type StaffMemberRow,
  isGrantableRole,
  staffMemberName,
  staffRoleAllows,
} from "@/server/domain/staff-directory.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import {
  ADMIN_STAFF_REVOKE_REASON_MAX_LENGTH,
  ADMIN_STAFF_REVOKE_REASON_MIN_LENGTH,
} from "@auction/shop-contracts";
import { ConfirmActionDialog, type OverflowAction } from "@auction/staff-ui";
import { ShieldCheck, UserCog, UserMinus } from "@auction/staff-ui/icons";
import { useCallback, useState } from "react";

type Pending =
  | { kind: "role"; member: StaffMemberRow }
  | { kind: "revoke"; member: StaffMemberRow }
  | { kind: "restore"; member: StaffMemberRow };

/** Change someone's role: pick the role, see what it allows, then confirm. */
function ChangeRoleDialog({ member, onClose }: { member: StaffMemberRow; onClose: () => void }) {
  const action = useAdminAction();
  const name = staffMemberName(member);
  const current = isGrantableRole(member.role) ? member.role : null;
  const [role, setRole] = useState<GrantableStaffRole | null>(current);
  const unchanged = role === current;
  const [sameRoleTried, setSameRoleTried] = useState(false);

  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Change ${name}’s role?`}
        description="What they can see and do changes the next time they load a page. The change is kept in the audit log."
        confirmLabel={role && !unchanged ? `Make them ${staffRoleLabel(role)}` : "Change role"}
        loading={action.pending}
        onConfirm={async () => {
          if (!role || unchanged) {
            setSameRoleTried(true);
            return;
          }
          const ok = await action.run(
            () =>
              grantStaffRole({
                identitySubjectId: member.identitySubjectId,
                role,
                idempotencyKey: action.idempotencyKey,
              }),
            `${name} is now ${staffRoleLabel(role)}`,
            "change this role",
          );
          if (ok) onClose();
        }}
      >
        <StaffRolePicker
          value={role}
          onChange={(next) => {
            setRole(next);
            setSameRoleTried(false);
          }}
          current={current}
          error={sameRoleTried && unchanged ? "Choose a role other than their current one." : null}
        />
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

function RevokeDialog({ member, onClose }: { member: StaffMemberRow; onClose: () => void }) {
  const action = useAdminAction();
  const name = staffMemberName(member);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Remove ${name}’s access?`}
        description={`${name} can no longer sign in to LAX Admin and loses the ${staffRoleLabel(member.role)} role. You can give them access again later.`}
        confirmLabel="Remove access"
        tone="danger"
        loading={action.pending}
        reason={{
          label: "Reason",
          description: `At least ${ADMIN_STAFF_REVOKE_REASON_MIN_LENGTH} characters. Kept in the audit log.`,
          minLength: ADMIN_STAFF_REVOKE_REASON_MIN_LENGTH,
          maxLength: ADMIN_STAFF_REVOKE_REASON_MAX_LENGTH,
          missingMessage: "Say why their access is being removed.",
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () =>
              revokeStaffRole({
                identitySubjectId: member.identitySubjectId,
                reason,
                idempotencyKey: action.idempotencyKey,
              }),
            `${name}’s access removed`,
            "remove this access",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

function RestoreDialog({ member, onClose }: { member: StaffMemberRow; onClose: () => void }) {
  const action = useAdminAction();
  const name = staffMemberName(member);
  const allows = staffRoleAllows(member.role);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Give ${name} access again?`}
        description={`They can sign in to LAX Admin again as ${staffRoleLabel(member.role)}${allows ? `: ${allows.charAt(0).toLowerCase()}${allows.slice(1)}` : "."}`}
        confirmLabel="Give access again"
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              grantStaffRole({
                identitySubjectId: member.identitySubjectId,
                role: member.role,
                idempotencyKey: action.idempotencyKey,
              }),
            `${name} can sign in again`,
            "give this access",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * A staff member's access actions, the same from the row's "…" menu and the record panel:
 * change role (a picker that says what each role allows), remove access (with a reason, kept in
 * the audit log) and give access again. Each is confirmed with Cancel first and asks for a fresh
 * sign-in when the API needs one. Nobody can change their own access.
 */
export function useStaffActions({ currentSubject }: { currentSubject: string }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const close = useCallback(() => setPending(null), []);

  const actionsFor = useCallback(
    (member: StaffMemberRow): OverflowAction[] => {
      const self = member.identitySubjectId === currentSubject;
      const selfReason = self ? { disabledReason: "Ask another administrator" } : {};
      if (member.disabledAt) {
        return [
          {
            id: "restore",
            label: "Give access again…",
            icon: ShieldCheck,
            onSelect: () => setPending({ kind: "restore", member }),
            ...selfReason,
          },
        ];
      }
      return [
        {
          id: "role",
          label: "Change role…",
          icon: UserCog,
          onSelect: () => setPending({ kind: "role", member }),
          ...selfReason,
        },
        {
          id: "revoke",
          label: "Remove access…",
          icon: UserMinus,
          tone: "danger",
          onSelect: () => setPending({ kind: "revoke", member }),
          ...selfReason,
        },
      ];
    },
    [currentSubject],
  );

  const dialogs = pending ? (
    pending.kind === "role" ? (
      <ChangeRoleDialog member={pending.member} onClose={close} />
    ) : pending.kind === "revoke" ? (
      <RevokeDialog member={pending.member} onClose={close} />
    ) : (
      <RestoreDialog member={pending.member} onClose={close} />
    )
  ) : null;

  return { actionsFor, dialogs, open: setPending };
}
