"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { grantStaffRole } from "@/server/application/admin-people-actions.server";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { SelectField, TextField } from "../fields";

const STAFF_ROLES = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

const ROLE_OPTIONS = STAFF_ROLES.map((value) => ({ value, label: staffRoleLabel(value) }));

export function GrantStaffRoleForm({ bidStaffUrl }: { bidStaffUrl: string | undefined }) {
  const mutation = useAdminMutation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operations");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const address = email.trim();

  return (
    <>
      <AdminForm
        title="Add staff by email"
        mutation={mutation}
        errors={errors}
        submitLabel="Grant role"
        description={
          <p className="text-sm text-on-surface-variant">
            The person must already have a LAX login.{" "}
            {bidStaffUrl ? (
              <>
                To bring in someone new, or to manage their access on every LAX platform, use{" "}
                <a className="underline" href={bidStaffUrl}>
                  Manage all LAX access
                </a>
                .
              </>
            ) : (
              "To bring in someone new, invite them from LAX admin."
            )}
          </p>
        }
        onSubmit={() => {
          const next = collectFieldErrors({
            email: requiredText(email, "Enter the email address."),
          });
          setErrors(next);
          if (!hasFieldErrors(next)) setConfirming(true);
        }}
      >
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          error={errors.email}
          disabled={mutation.pending}
          onChange={setEmail}
        />
        <SelectField
          name="role"
          label="Role"
          value={role}
          options={ROLE_OPTIONS}
          disabled={mutation.pending}
          onChange={setRole}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Grant ${staffRoleLabel(role)} role`}
        body={`${address} will be able to sign in to LAX Admin with the ${staffRoleLabel(role)} role. You can revoke it later from the staff list.`}
        confirmLabel="Grant role"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () => grantStaffRole({ email: address, role, idempotencyKey: mutation.idempotencyKey }),
            "Staff role granted",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
