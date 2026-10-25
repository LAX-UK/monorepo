"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  revokeShopStaffAccessAction,
  setShopStaffRoleAction,
} from "@/lib/admin/people/staff-access.actions";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { notify } from "@/lib/ui/notify";
import { EnumSelect, Field, Notice, StaffButton, StaffDialog } from "@auction/staff-ui";
import { laxStaffPlatform } from "@auction/types";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

const SHOP_ROLES = laxStaffPlatform("shop").roles;
const ROLE_OPTIONS = SHOP_ROLES.map((role) => ({
  value: role.value,
  label: role.label,
  description: role.summary,
}));

function ShopRoleDialog({
  userId,
  userName,
  currentRole,
  onClose,
}: {
  userId: string;
  userName: string;
  currentRole: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [role, setRole] = useState<string | null>(currentRole);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const save = () => {
    if (!role) {
      setRoleError("Choose a Shop role.");
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await setShopStaffRoleAction(userId, role);
      if (result.ok) {
        onClose();
        notify.success("Shop access requested", {
          description: "It shows here once Shop applies it.",
        });
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
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={currentRole ? `Change ${userName}'s Shop role` : `Give ${userName} Shop access`}
      description="Shop applies the change and it is kept in the audit log."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={save}>
            {currentRole ? "Save Shop role" : "Give access"}
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
        <Field label="Shop role" error={roleError} disabled={busy}>
          <EnumSelect<string>
            value={role}
            onValueChange={(next) => {
              setRole(next);
              setRoleError(null);
            }}
            options={ROLE_OPTIONS}
            placeholder="Choose a Shop role"
          />
        </Field>
      </div>
    </StaffDialog>
  );
}

/** Give, change or remove someone's access to LAX Shop. Shop applies it, so it shows as pending. */
export function ShopStaffAccessControl({
  userId,
  userName,
  currentRole,
}: {
  userId: string;
  userName: string;
  currentRole: string | null;
}) {
  const confirm = useStaffConfirm();
  const [choosing, setChoosing] = useState(false);

  return (
    <>
      <StaffButton variant="secondary" size="sm" onClick={() => setChoosing(true)}>
        {currentRole ? "Change Shop role" : "Give Shop access"}
      </StaffButton>
      {currentRole ? (
        <StaffButton
          variant="danger-secondary"
          size="sm"
          onClick={() =>
            confirm.ask({
              title: `Remove ${userName}'s Shop access?`,
              description:
                "They can no longer use the Shop staff tools. Shop applies the removal, so it shows here once it has.",
              confirmLabel: "Remove Shop access",
              tone: "danger",
              stepUpAction: "remove Shop access",
              run: () => revokeShopStaffAccessAction(userId),
              success: "Removal requested",
            })
          }
        >
          Remove Shop access
        </StaffButton>
      ) : null}
      {choosing ? (
        <ShopRoleDialog
          userId={userId}
          userName={userName}
          currentRole={currentRole}
          onClose={() => setChoosing(false)}
        />
      ) : null}
      {confirm.dialog}
    </>
  );
}
