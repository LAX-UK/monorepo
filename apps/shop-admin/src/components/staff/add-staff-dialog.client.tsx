"use client";

import { StaffRolePicker } from "@/components/staff/staff-role-picker.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { grantStaffRole } from "@/server/application/admin-people-actions.server";
import { type GrantableStaffRole, looksLikeEmail } from "@/server/domain/staff-directory.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import {
  Field,
  FormErrorSummary,
  StaffButton,
  StaffDialog,
  TextInput,
  UnsavedChangesDialog,
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { useId, useState } from "react";

type Errors = Partial<Record<"email" | "role", string>>;

function check(email: string, role: GrantableStaffRole | null): Errors {
  const address = email.trim();
  return {
    ...(!address
      ? { email: "Enter the email on their LAX login." }
      : !looksLikeEmail(address)
        ? { email: "Enter an email address like name@lax.art." }
        : {}),
    ...(role ? {} : { role: "Choose what they can do in LAX Admin." }),
  };
}

/**
 * Gives someone with a LAX login access to LAX Admin: their email, and a role chosen from a list
 * that says what each role allows. Checked on submit, then again as each field changes; a
 * failure stays in the dialog. People without a LAX login are invited from Bid admin, which
 * manages access across every LAX tool.
 */
export function AddStaffDialog({
  open,
  onOpenChange,
  bidStaffUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidStaffUrl: string | undefined;
}) {
  const ids = useId();
  const formId = `${ids}-form`;
  const emailId = `${ids}-email`;
  const roleId = `${ids}-role`;
  const action = useAdminAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GrantableStaffRole | null>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const errors = failedSubmits > 0 ? check(email, role) : {};
  const dirty = open && (email.trim() !== "" || role !== null);
  const guard = useUnsavedChanges(dirty, { interceptBack: false });

  const reset = () => {
    setEmail("");
    setRole(null);
    setFailedSubmits(0);
  };

  const requestClose = async () => {
    if (action.pending) return;
    if (
      dirty &&
      !(await confirmDiscardChanges({
        title: "Discard this new staff member?",
        description: "They will not be given access.",
        confirmLabel: "Discard",
      }))
    ) {
      return;
    }
    reset();
    onOpenChange(false);
  };

  const submit = async () => {
    const found = check(email, role);
    if (Object.keys(found).length > 0 || !role) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    const address = email.trim();
    const ok = await action.run(
      () => grantStaffRole({ email: address, role, idempotencyKey: action.idempotencyKey }),
      `${address} can now sign in as ${staffRoleLabel(role)}`,
      "give staff access",
    );
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else void requestClose();
        }}
        size="md"
        title="Add staff"
        description="For someone who already has a LAX login. They can sign in to LAX Admin straight away with the role you choose."
        footer={
          <>
            <StaffButton
              variant="secondary"
              disabled={action.pending}
              onClick={() => void requestClose()}
            >
              Cancel
            </StaffButton>
            <StaffButton type="submit" form={formId} variant="primary" loading={action.pending}>
              {role ? `Add as ${staffRoleLabel(role)}` : "Add staff"}
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          aria-label="Add staff"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormErrorSummary
            focusKey={failedSubmits}
            errors={[
              ...(errors.email ? [{ fieldId: emailId, message: errors.email }] : []),
              ...(errors.role ? [{ fieldId: roleId, message: errors.role }] : []),
            ]}
          />
          {action.error}
          <Field
            label="Email"
            id={emailId}
            description={
              bidStaffUrl ? (
                <>
                  No LAX login yet? Invite them from{" "}
                  <a className="font-medium text-staff-fg underline" href={bidStaffUrl}>
                    Bid admin staff
                  </a>
                  .
                </>
              ) : (
                "No LAX login yet? Invite them from Bid admin."
              )
            }
            error={errors.email ?? null}
            disabled={action.pending}
          >
            <TextInput
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="For example, sam@lax.art"
            />
          </Field>
          <StaffRolePicker
            id={roleId}
            value={role}
            onChange={setRole}
            error={errors.role ?? null}
            disabled={action.pending}
          />
        </form>
      </StaffDialog>
      <UnsavedChangesDialog guard={guard} />
      {action.stepUpDialog}
    </>
  );
}
