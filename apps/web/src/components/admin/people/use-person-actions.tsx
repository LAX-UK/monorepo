"use client";

import { StaffEmailChangeDialog } from "@/components/admin/people/staff-email-change-dialog";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminCancelEmailChangeResultAction,
  adminResetTwoFactorResultAction,
  adminSetUserRoleResultAction,
  adminSuspendUserResultAction,
  adminUnsuspendUserResultAction,
} from "@/lib/actions/admin";
import { type EmailChangeAccess, emailChangeBlockedReason } from "@/lib/admin/staff-email-change";
import { staffRoleFilterOptions } from "@/lib/admin/staff-role-presenter";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { notify } from "@/lib/ui/notify";
import {
  EnumSelect,
  Field,
  Notice,
  type OverflowAction,
  StaffButton,
  StaffDialog,
} from "@auction/staff-ui";
import type { UserRole, UserStaffRole } from "@auction/types";
import {
  ADMIN_EMAIL_CHANGE_REASON_MIN,
  ADMIN_SUSPEND_REASON_MIN,
  ADMIN_TWO_FACTOR_RESET_REASON_MIN,
} from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

/** What the account actions need to know about a person, from a list row or their page. */
export type PersonActionTarget = {
  id: string;
  name: string;
  role: UserRole;
  staffRole: UserStaffRole | null;
  suspended: boolean;
  twoFactorEnabled: boolean;
  /** Their address and identity check, for the actions that need them (an email change). */
  email?: string;
  kycStatus?: string;
};

export type PersonActionAccess = {
  /** May suspend, unsuspend and reset two-step verification. */
  canModerate: boolean;
  /** May change someone's role and staff role. */
  canManageRoles: boolean;
  /** Left out where the email change is not offered, such as a list row. */
  emailChange?: EmailChangeAccess;
};

const ROLE_OPTIONS = [
  { value: "client", label: "Client", description: "Bids, buys and sells. No staff tools." },
  { value: "staff", label: "Staff", description: "Uses the staff tools with the role below." },
] as const satisfies readonly { value: UserRole; label: string; description: string }[];

function RoleDialog({
  target,
  onClose,
}: {
  target: PersonActionTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [role, setRole] = useState<UserRole>(target?.role ?? "client");
  const [staffRole, setStaffRole] = useState<UserStaffRole | null>(target?.staffRole ?? null);
  const [staffRoleError, setStaffRoleError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const save = () => {
    if (!target) return;
    if (role === "staff" && !staffRole) {
      setStaffRoleError("Choose a staff role.");
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await adminSetUserRoleResultAction(target.id, {
        role,
        staffRole: role === "staff" ? staffRole : null,
      });
      if (result.ok) {
        onClose();
        notify.success(`${target.name}'s role updated`);
        router.refresh();
        return;
      }
      if (handleStaffStepUp(result)) {
        onClose();
        return;
      }
      setFailure(result.error);
    });
  };

  return (
    <StaffDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={target ? `Change ${target.name}'s role` : "Change role"}
      description="Their access changes the next time they load a page. The change is kept in the audit log."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={save}>
            Save role
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        <Field label="Role" disabled={busy}>
          <EnumSelect<UserRole>
            value={role}
            onValueChange={(next) => {
              setRole(next);
              setStaffRoleError(null);
            }}
            options={ROLE_OPTIONS}
          />
        </Field>
        {role === "staff" ? (
          <Field
            label="Staff role"
            description="Decides which staff tools and actions they can use."
            error={staffRoleError}
            disabled={busy}
          >
            <EnumSelect<UserStaffRole>
              value={staffRole}
              onValueChange={(next) => {
                setStaffRole(next);
                setStaffRoleError(null);
              }}
              options={staffRoleFilterOptions}
              placeholder="Choose a staff role"
            />
          </Field>
        ) : null}
      </div>
    </StaffDialog>
  );
}

/**
 * A person's account actions, the same from a list row's `…` menu, the record panel and their
 * page: change role, change or cancel an email change, reset two-step verification, suspend and
 * unsuspend. Suspending, the reset and cancelling an email change take an audited reason and may
 * ask for a fresh sign-in; Cancel always has the first
 * focus. Actions a role can never take are left out; ones the account's state blocks are
 * disabled with the reason.
 */
export function usePersonActions(access: PersonActionAccess) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [roleTarget, setRoleTarget] = useState<PersonActionTarget | null>(null);
  const [emailTarget, setEmailTarget] = useState<PersonActionTarget | null>(null);

  const suspend = useCallback(
    (person: PersonActionTarget) =>
      ask({
        title: `Suspend ${person.name}?`,
        description:
          person.role === "staff"
            ? "They are signed out everywhere and cannot use the staff tools until the account is unsuspended."
            : "They are signed out everywhere and cannot sign in, bid or buy until the account is unsuspended.",
        confirmLabel: "Suspend account",
        tone: "danger",
        reason: {
          label: "Reason for suspending",
          description: `At least ${ADMIN_SUSPEND_REASON_MIN} characters. Kept in the audit log.`,
          minLength: ADMIN_SUSPEND_REASON_MIN,
          maxLength: 500,
        },
        stepUpAction: "suspend this account",
        run: ({ reason }) => adminSuspendUserResultAction(person.id, { reason }),
        success: `${person.name} suspended`,
      }),
    [ask],
  );

  const unsuspend = useCallback(
    (person: PersonActionTarget) =>
      ask({
        title: `Unsuspend ${person.name}?`,
        description:
          person.role === "staff"
            ? "They can sign in to the staff tools again straight away, with the role they had."
            : "They can sign in, bid and buy again straight away.",
        confirmLabel: "Unsuspend account",
        stepUpAction: "unsuspend this account",
        run: () => adminUnsuspendUserResultAction(person.id),
        success: `${person.name} unsuspended`,
      }),
    [ask],
  );

  const resetTwoFactor = useCallback(
    (person: PersonActionTarget) =>
      ask({
        title: `Reset ${person.name}'s two-step verification?`,
        description:
          "Only after you have checked who they are. Their authenticator app and backup codes stop working, they are signed out on every device, and we email them that LAX support reset it.",
        confirmLabel: "Reset two-step verification",
        tone: "danger",
        reason: {
          label: "Reason for the reset",
          description: `At least ${ADMIN_TWO_FACTOR_RESET_REASON_MIN} characters. Kept in the audit log.`,
          minLength: ADMIN_TWO_FACTOR_RESET_REASON_MIN,
          maxLength: 500,
        },
        stepUpAction: "reset two-step verification",
        run: ({ reason }) => adminResetTwoFactorResultAction(person.id, { reason }),
        success: "Two-step verification reset",
      }),
    [ask],
  );

  const cancelEmailChange = useCallback(
    (person: PersonActionTarget) =>
      ask({
        title: `Cancel ${person.name}'s email change?`,
        description:
          "The link already emailed to the new address stops working and the address stays as it is. Any sessions ended when the change started stay ended. We tell them by email that LAX staff cancelled it.",
        confirmLabel: "Cancel email change",
        cancelLabel: "Keep it",
        reason: {
          label: "Reason for cancelling",
          description: `At least ${ADMIN_EMAIL_CHANGE_REASON_MIN} characters. Kept in the audit log.`,
          minLength: ADMIN_EMAIL_CHANGE_REASON_MIN,
          maxLength: 500,
        },
        stepUpAction: "cancel the email change",
        run: ({ reason }) => adminCancelEmailChangeResultAction(person.id, { reason }),
        success: "Email change cancelled",
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (person: PersonActionTarget): OverflowAction[] => {
      const actions: OverflowAction[] = [];
      if (access.canManageRoles) {
        // Staff hold several roles, each given and removed on their record; a client is made staff.
        actions.push(
          person.role === "staff"
            ? { id: "role", label: "Manage roles", href: `/admin/staff/${person.id}#roles` }
            : { id: "role", label: "Change role", onSelect: () => setRoleTarget(person) },
        );
      }
      const emailChange = access.emailChange;
      if (emailChange?.canChange && person.email !== undefined) {
        const blocked = emailChangeBlockedReason(emailChange, person);
        actions.push({
          id: "change-email",
          label: "Change email address",
          onSelect: () => setEmailTarget(person),
          ...(blocked ? { disabledReason: blocked } : {}),
        });
        actions.push({
          id: "cancel-email-change",
          label: "Cancel email change",
          onSelect: () => cancelEmailChange(person),
          ...(blocked ? { disabledReason: blocked } : {}),
        });
      }
      if (access.canModerate) {
        actions.push({
          id: "reset-two-factor",
          label: "Reset two-step verification",
          tone: "danger",
          onSelect: () => resetTwoFactor(person),
          ...(person.twoFactorEnabled
            ? {}
            : { disabledReason: "Two-step verification is not turned on" }),
        });
        actions.push(
          person.suspended
            ? { id: "unsuspend", label: "Unsuspend account", onSelect: () => unsuspend(person) }
            : {
                id: "suspend",
                label: "Suspend account",
                tone: "danger",
                onSelect: () => suspend(person),
              },
        );
      }
      return actions;
    },
    [
      access.canManageRoles,
      access.canModerate,
      access.emailChange,
      cancelEmailChange,
      resetTwoFactor,
      suspend,
      unsuspend,
    ],
  );

  const dialogs = (
    <>
      {confirm.dialog}
      <RoleDialog
        key={roleTarget?.id ?? "closed"}
        target={roleTarget}
        onClose={() => setRoleTarget(null)}
      />
      <StaffEmailChangeDialog
        target={
          emailTarget?.email !== undefined
            ? {
                id: emailTarget.id,
                name: emailTarget.name,
                email: emailTarget.email,
                kycStatus: emailTarget.kycStatus ?? "unverified",
              }
            : null
        }
        onClose={() => setEmailTarget(null)}
      />
    </>
  );

  return {
    actionsFor,
    dialogs,
    suspend,
    unsuspend,
    resetTwoFactor,
    cancelEmailChange,
    changeRole: setRoleTarget,
    changeEmail: setEmailTarget,
  };
}
