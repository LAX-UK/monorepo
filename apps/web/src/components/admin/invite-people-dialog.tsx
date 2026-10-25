"use client";

import { InviteEmailChipInput } from "@/components/admin/invite-email-chip-input";
import {
  type DraftPlatformGrant,
  InvitePlatformAccessPicker,
  platformGrantsIssue,
  platformRoleId,
} from "@/components/admin/invite-platform-access-picker";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin/admin-invitations";
import { MAX_INVITE_BATCH } from "@/lib/admin/parse-invite-email-list";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  UnsavedChangesDialog,
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

type InviteRole = "client" | "staff";

type Failure = { email: string; message: string };

type Outcome = { sent: number; failures: Failure[] };

export type InvitePeopleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the role, e.g. "staff" when opened from the Staff list. */
  defaultRole?: InviteRole;
};

const DISCARD_PROMPT = {
  title: "Discard this invitation?",
  description: "The addresses you entered will not be invited.",
  confirmLabel: "Discard",
};

function sentMessage(count: number): string {
  return count === 1 ? "Invitation sent" : `${count} invitations sent`;
}

function outcomeTitle({ sent, failures }: Outcome): string {
  if (sent > 0) return `${sent} sent, ${failures.length} not sent`;
  return failures.length === 1 ? "Invitation not sent" : "No invitations sent";
}

/**
 * Invites one or more people by email as a client or as staff. Staff choose where the person
 * gets access and the role on each platform. One request is made per address, and any that
 * fail stay in the dialog with the reason so they can be fixed and sent again.
 */
export function InvitePeopleDialog({
  open,
  onOpenChange,
  defaultRole = "client",
}: InvitePeopleDialogProps) {
  const router = useRouter();
  const ids = useId();
  const formId = `${ids}-form`;
  const recipientsId = `${ids}-recipients`;
  const roleId = `${ids}-role`;
  const accessId = `${ids}-access`;
  const roleRadioIds: Record<InviteRole, string> = {
    client: `${ids}-role-client`,
    staff: `${ids}-role-staff`,
  };

  const [emails, setEmails] = useState<string[]>([]);
  const [emailProblem, setEmailProblem] = useState<string | null>(null);
  const [role, setRole] = useState<InviteRole>(defaultRole);
  const [grants, setGrants] = useState<DraftPlatformGrant[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const dirty = open && emails.length > 0;
  const guard = useUnsavedChanges(dirty, { interceptBack: false });

  const reset = useCallback(() => {
    setEmails([]);
    setEmailProblem(null);
    setRole(defaultRole);
    setGrants([]);
    setAttempted(false);
    setFailedSubmits(0);
    setOutcome(null);
  }, [defaultRole]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Re-checked on every change once a submit has failed; nothing shows before that.
  const recipientsError = !attempted
    ? null
    : (emailProblem ?? (emails.length === 0 ? "Enter at least one email address." : null));
  const grantsIssue = attempted && role === "staff" ? platformGrantsIssue(grants) : null;

  const summary = [
    ...(recipientsError ? [{ fieldId: recipientsId, message: recipientsError }] : []),
    ...(grantsIssue
      ? [
          {
            fieldId:
              grantsIssue.target === "role"
                ? platformRoleId(accessId, grantsIssue.product)
                : accessId,
            message: grantsIssue.message,
          },
        ]
      : []),
  ];

  async function requestClose() {
    if (submitting) return;
    if (dirty && !(await confirmDiscardChanges(DISCARD_PROMPT))) return;
    reset();
    onOpenChange(false);
  }

  async function submit() {
    setOutcome(null);
    const invalidRecipients = emails.length === 0 || emailProblem !== null;
    const invalidGrants = role === "staff" && platformGrantsIssue(grants) !== null;
    setAttempted(true);
    if (invalidRecipients || invalidGrants) {
      setFailedSubmits((count) => count + 1);
      return;
    }

    setSubmitting(true);
    const failures: Failure[] = [];
    const sentTo = new Set<string>();
    for (const email of emails) {
      try {
        const result = await adminCreateInvitationResultAction({
          email,
          targetRole: role,
          ...(role === "staff" ? { grants } : {}),
        });
        if (result.ok) sentTo.add(email);
        else failures.push({ email, message: result.error });
      } catch {
        failures.push({ email, message: "Something went wrong. Try again." });
      }
    }
    setSubmitting(false);

    if (sentTo.size > 0) router.refresh();
    if (failures.length === 0) {
      notify.success(sentMessage(sentTo.size));
      reset();
      onOpenChange(false);
      return;
    }
    if (sentTo.size > 0) notify.success(sentMessage(sentTo.size));
    // Only the addresses that failed stay, so sending again never repeats an invitation.
    setEmails((current) => current.filter((email) => !sentTo.has(email)));
    setOutcome({ sent: sentTo.size, failures });
  }

  const submitLabel = emails.length > 1 ? `Send ${emails.length} invitations` : "Send invitation";

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else void requestClose();
        }}
        size="md"
        title="Invite people"
        description="Each person receives a secure sign-up link by email. Invitations expire after 7 days."
        footer={
          <>
            <StaffButton
              variant="secondary"
              disabled={submitting}
              onClick={() => void requestClose()}
            >
              Cancel
            </StaffButton>
            <StaffButton type="submit" form={formId} variant="primary" loading={submitting}>
              {submitLabel}
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          aria-label="Invite people"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormErrorSummary errors={summary} focusKey={failedSubmits} />
          {outcome ? (
            <Notice tone="danger" alert title={outcomeTitle(outcome)}>
              <ul className="m-0 list-disc pl-4">
                {outcome.failures.map((failure) => (
                  <li key={failure.email}>
                    <span className="font-medium">{failure.email}</span>: {failure.message}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <Field
            label="Recipients"
            id={recipientsId}
            description={`Paste a list or separate addresses with commas. Up to ${MAX_INVITE_BATCH} at a time.`}
            error={recipientsError ?? emailProblem}
            disabled={submitting}
          >
            <InviteEmailChipInput
              emails={emails}
              onChange={setEmails}
              onProblem={setEmailProblem}
              disabled={submitting}
            />
          </Field>
          <Field label="Invite as" id={roleId} disabled={submitting}>
            <StaffRadioGroup
              id={roleId}
              value={role}
              disabled={submitting}
              onValueChange={(next) => {
                setRole(next === "staff" ? "staff" : "client");
              }}
            >
              <ChoiceRow
                htmlFor={roleRadioIds.client}
                label="Client"
                description="Creates a LAX account with the link we send. Existing accounts do not need an invitation."
                disabled={submitting}
                control={<StaffRadio id={roleRadioIds.client} value="client" />}
              />
              <ChoiceRow
                htmlFor={roleRadioIds.staff}
                label="Staff"
                description="Works on the LAX platforms you choose below."
                disabled={submitting}
                control={<StaffRadio id={roleRadioIds.staff} value="staff" />}
              />
            </StaffRadioGroup>
          </Field>
          {role === "staff" ? (
            <Field
              label="Platform access"
              id={accessId}
              description="One LAX account works on every platform. Choose where this person gets staff access and the role on each. People who already have an account can accept after signing in."
              error={grantsIssue?.target === "access" ? grantsIssue.message : null}
              disabled={submitting}
            >
              <InvitePlatformAccessPicker
                id={accessId}
                value={grants}
                onChange={setGrants}
                roleError={
                  grantsIssue?.target === "role"
                    ? { product: grantsIssue.product, message: grantsIssue.message }
                    : null
                }
                disabled={submitting}
              />
            </Field>
          ) : null}
        </form>
      </StaffDialog>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
