"use client";

import { adminAssignStaffRoleAction } from "@/lib/actions/admin/admin-staff-roles";
import {
  addStaffRoleIssue,
  addableStaffRoleOptions,
  earliestStaffRoleLastDay,
  staffRoleEndsAtFromLastDay,
} from "@/lib/admin/people/staff-roles.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import type { StaffRoleAssignmentView } from "@/lib/data/http/staff-roles.server";
import { notify } from "@/lib/ui/notify";
import {
  DateInput,
  EnumSelect,
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
} from "@auction/staff-ui";
import { type UserStaffRole, bidStaffRoleLabel } from "@auction/types";
import { STAFF_ROLE_REASON_MAX, STAFF_ROLE_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

type Props = {
  person: { id: string; name: string };
  held: readonly StaffRoleAssignmentView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The moment the page was built, so every date reads the same on server and client. */
  now: Date;
};

const REASON_MESSAGE = `Give a reason of at least ${STAFF_ROLE_REASON_MIN} characters.`;

/**
 * Gives a staff member one more Bid role: the role (each with what the job does), an optional
 * last day, and a reason for the audit log. A role that cannot join the ones they hold says why
 * as soon as it is chosen, in the same words the API would use.
 */
export function AddStaffRoleDialog({ person, held, open, onOpenChange, now }: Props) {
  const router = useRouter();
  const ids = useId();
  const roleId = `${ids}-role`;
  const lastDayId = `${ids}-last-day`;
  const reasonId = `${ids}-reason`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [role, setRole] = useState<UserStaffRole | null>(null);
  const [lastDay, setLastDay] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const endsAt = staffRoleEndsAtFromLastDay(lastDay);
  // The role rule is shown as soon as a role is chosen; the rest only after a failed submit.
  const ruleIssue = role ? addStaffRoleIssue(held, role, endsAt, now) : null;
  const roleError =
    ruleIssue?.field === "role"
      ? ruleIssue.message
      : attempts > 0 && !role
        ? "Choose a role."
        : null;
  const lastDayError = ruleIssue?.field === "lastDay" ? ruleIssue.message : null;
  const reasonError =
    attempts > 0 && reason.trim().length < STAFF_ROLE_REASON_MIN ? REASON_MESSAGE : null;
  const errors = [
    ...(roleError ? [{ fieldId: roleId, message: roleError }] : []),
    ...(lastDayError ? [{ fieldId: lastDayId, message: lastDayError }] : []),
    ...(reasonError ? [{ fieldId: reasonId, message: reasonError }] : []),
  ];

  function close() {
    if (busy) return;
    setRole(null);
    setLastDay(null);
    setReason("");
    setAttempts(0);
    setFailure(null);
    onOpenChange(false);
  }

  function submit() {
    setFailure(null);
    if (!role || ruleIssue || reason.trim().length < STAFF_ROLE_REASON_MIN) {
      setAttempts((count) => count + 1);
      return;
    }
    startTransition(async () => {
      const result = await adminAssignStaffRoleAction(person.id, {
        role,
        endsAt,
        reason: reason.trim(),
      });
      if (result.ok) {
        notify.success(`${bidStaffRoleLabel(role)} role given to ${person.name}`);
        close();
        router.refresh();
        return;
      }
      if (handleStaffStepUp(result)) {
        close();
        return;
      }
      setFailure(result.error);
    });
  }

  const options = addableStaffRoleOptions(held);

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      size="md"
      title={`Add a role for ${person.name}`}
      description="Their permissions become the sum of their roles the next time they load a page."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={`${ids}-form`} variant="primary" loading={busy}>
            Add role
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Add a role for ${person.name}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormErrorSummary errors={attempts > 0 ? errors : []} focusKey={attempts} />
        {failure ? (
          <Notice tone="danger" alert title="The role was not added">
            {failure}
          </Notice>
        ) : null}
        <Field label="Role" id={roleId} error={roleError} disabled={busy}>
          <EnumSelect<UserStaffRole>
            value={role}
            onValueChange={setRole}
            options={options}
            placeholder="Choose a role"
          />
        </Field>
        <Field
          label="Last day"
          id={lastDayId}
          optional
          description="The role ends at midnight after this day. Leave empty to keep it until someone removes it."
          error={lastDayError}
          disabled={busy}
        >
          <DateInput
            value={lastDay}
            onValueChange={setLastDay}
            min={earliestStaffRoleLastDay(now)}
            placeholder="e.g. 30 Nov 2026"
          />
        </Field>
        <Field
          label="Reason"
          id={reasonId}
          description="Why they need this role. Kept in the audit log."
          error={reasonError}
          disabled={busy}
        >
          <TextArea
            value={reason}
            maxLength={STAFF_ROLE_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
