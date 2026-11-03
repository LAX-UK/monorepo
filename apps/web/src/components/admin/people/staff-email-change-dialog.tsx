"use client";

import {
  EmailChangeDone,
  KycRecordPanel,
  type KycRecordState,
} from "@/components/admin/people/staff-email-change-parts";
import {
  adminEmailChangeKycRecordResultAction,
  adminStartEmailChangeResultAction,
} from "@/lib/actions/admin";
import {
  type EmailChangeDraft,
  type EmailChangeErrors,
  type EmailChangeField,
  type EmailChangeProofKind,
  kycMatchAvailable,
  toEmailChangeBody,
  validateEmailChange,
} from "@/lib/admin/staff-email-change";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { ADMIN_EMAIL_CHANGE_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

/** Who the change is for, from their page. */
export type EmailChangeTarget = {
  id: string;
  name: string;
  email: string;
  kycStatus: string;
};

const EMPTY_DRAFT = (currentEmail: string): EmailChangeDraft => ({
  newEmail: "",
  currentEmail,
  reason: "",
  proofKind: null,
  kycSessionId: null,
  kycConfirmed: false,
  reference: "",
});

type Props = {
  /** The person to move; the dialog is closed while this is null. */
  target: EmailChangeTarget | null;
  /** Why the viewer may not do this (no access), shown instead of the form. */
  blockedReason?: string | null;
  onClose: () => void;
};

/**
 * Moves a person's account to a new email address when they have lost the old inbox. Staff say
 * how they checked who is asking: a match with the verified KYC record (its name and date of
 * birth are shown to compare) or a fresh ID check (its reference is recorded). A reason is
 * required, and the API asks for a fresh sign-in. The address changes only when the person
 * follows the link sent to the new one, so the dialog ends on what happens next, not on "done".
 */
export function StaffEmailChangeDialog({ target, blockedReason = null, onClose }: Props) {
  const open = target !== null;
  const router = useRouter();
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<EmailChangeField, string> = {
    newEmail: `${ids}-new-email`,
    proof: `${ids}-proof`,
    reference: `${ids}-reference`,
    kycConfirmed: `${ids}-kyc-confirmed`,
    reason: `${ids}-reason`,
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<EmailChangeDraft>(EMPTY_DRAFT(target?.email ?? ""));
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [kyc, setKyc] = useState<KycRecordState>({ status: "loading" });
  const [failure, setFailure] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const targetId = target?.id ?? null;
  const loadKyc = useCallback(() => {
    if (!targetId) return;
    setKyc({ status: "loading" });
    void adminEmailChangeKycRecordResultAction(targetId).then((result) => {
      if (!result.ok) {
        setKyc({ status: "error", message: result.error });
        return;
      }
      const record = result.data ?? null;
      if (!record) {
        setKyc({ status: "none" });
        setDraft((current) => ({ ...current, kycSessionId: null, kycConfirmed: false }));
        return;
      }
      setKyc({ status: "ready", record });
      setDraft((current) => ({ ...current, kycSessionId: record.sessionId }));
    });
  }, [targetId]);

  // Each opening starts clean; a closed dialog keeps nothing of the last person.
  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_DRAFT(target?.email ?? ""));
    setAttempted(false);
    setFailure(null);
    setRefused(null);
    setStarted(null);
    setKyc({ status: "loading" });
  }, [open, target?.email]);

  const chooseProof = (kind: EmailChangeProofKind) => {
    setDraft((current) => ({ ...current, proofKind: kind, kycConfirmed: false }));
    // The record is fetched only when staff choose to compare with it: showing it is audited.
    if (kind === "kyc_match" && kyc.status !== "ready") loadKyc();
  };

  const errors: EmailChangeErrors = attempted ? validateEmailChange(draft) : {};
  const summary = (Object.keys(errors) as EmailChangeField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );

  const submit = () => {
    if (!target) return;
    setAttempted(true);
    const body =
      Object.keys(validateEmailChange(draft)).length === 0 ? toEmailChangeBody(draft) : null;
    if (!body) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await adminStartEmailChangeResultAction(target.id, body);
      if (result.ok) {
        setStarted(result.data?.pendingEmail ?? body.newEmail);
        router.refresh();
        return;
      }
      if (handleStaffStepUp(result)) {
        onClose();
        return;
      }
      if (result.status === 403) {
        setRefused(result.error);
        return;
      }
      setFailure(result.error);
    });
  };

  const blocked = refused ?? blockedReason;
  const close = () => {
    if (!busy) onClose();
  };

  const footer = started ? (
    <StaffButton ref={cancelRef} variant="primary" onClick={onClose}>
      Close
    </StaffButton>
  ) : blocked ? (
    <StaffButton ref={cancelRef} variant="secondary" onClick={onClose}>
      Close
    </StaffButton>
  ) : (
    <>
      <StaffButton ref={cancelRef} variant="secondary" onClick={close} disabled={busy}>
        Cancel
      </StaffButton>
      <StaffButton type="submit" form={formId} variant="primary" loading={busy}>
        Send confirmation to the new address
      </StaffButton>
    </>
  );

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={target ? `Change ${target.name}'s email address` : "Change email address"}
      description={
        started || blocked
          ? undefined
          : "For someone who can no longer open the inbox their account uses. Check who is asking first. The change is kept in the audit log."
      }
      footer={footer}
    >
      {started && target ? (
        <EmailChangeDone name={target.name} pendingEmail={started} currentEmail={target.email} />
      ) : blocked ? (
        <Notice tone="warning" alert title="You can't change this address">
          {blocked}
        </Notice>
      ) : target ? (
        <form
          id={formId}
          noValidate
          aria-label={`Change ${target.name}'s email address`}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormErrorSummary errors={summary} focusKey={failedSubmits} />
          {failure ? (
            <Notice tone="danger" alert title="That did not go through">
              {failure}
            </Notice>
          ) : null}
          <Field
            label="New email address"
            id={fieldIds.newEmail}
            description={`Now ${target.email}. They must be able to open the new inbox.`}
            error={errors.newEmail}
            disabled={busy}
          >
            <TextInput
              type="email"
              autoComplete="off"
              inputMode="email"
              spellCheck={false}
              value={draft.newEmail}
              maxLength={254}
              onChange={(event) =>
                setDraft((current) => ({ ...current, newEmail: event.target.value }))
              }
            />
          </Field>

          <ChoiceFieldset
            legend="How you checked who is asking"
            id={fieldIds.proof}
            error={errors.proof}
            disabled={busy}
          >
            <StaffRadioGroup
              value={draft.proofKind ?? ""}
              disabled={busy}
              onValueChange={(next) => chooseProof(next as EmailChangeProofKind)}
            >
              <ChoiceRow
                htmlFor={`${ids}-proof-kyc`}
                label="Matches the KYC record"
                description={
                  kycMatchAvailable(target.kycStatus)
                    ? "Compare their name and date of birth with the verified record."
                    : "No verified KYC record for this person."
                }
                disabled={busy || !kycMatchAvailable(target.kycStatus)}
                control={
                  <StaffRadio
                    id={`${ids}-proof-kyc`}
                    value="kyc_match"
                    disabled={busy || !kycMatchAvailable(target.kycStatus)}
                  />
                }
              />
              <ChoiceRow
                htmlFor={`${ids}-proof-id`}
                label="Fresh ID check"
                description="You checked their ID just now and have its reference."
                disabled={busy}
                control={<StaffRadio id={`${ids}-proof-id`} value="id_check" disabled={busy} />}
              />
            </StaffRadioGroup>
          </ChoiceFieldset>

          {draft.proofKind === "kyc_match" ? (
            <div className="flex flex-col gap-3">
              <KycRecordPanel state={kyc} onRetry={loadKyc} />
              {kyc.status === "ready" ? (
                <div className="flex flex-col gap-1">
                  <ChoiceRow
                    htmlFor={fieldIds.kycConfirmed}
                    label="Their name and date of birth match this record"
                    description="Ask them to say both. Don't read the record out."
                    disabled={busy}
                    control={
                      <StaffCheckbox
                        id={fieldIds.kycConfirmed}
                        checked={draft.kycConfirmed}
                        disabled={busy}
                        aria-invalid={errors.kycConfirmed ? true : undefined}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({ ...current, kycConfirmed: checked === true }))
                        }
                      />
                    }
                  />
                  {errors.kycConfirmed ? (
                    <p className="text-staff-xs font-medium text-staff-danger">
                      {errors.kycConfirmed}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.proofKind === "id_check" ? (
            <Field
              label="ID check reference"
              id={fieldIds.reference}
              description="Where the check can be found again."
              error={errors.reference}
              disabled={busy}
            >
              <TextInput
                autoComplete="off"
                spellCheck={false}
                value={draft.reference}
                maxLength={100}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, reference: event.target.value }))
                }
              />
            </Field>
          ) : null}

          <Field
            label="Reason"
            id={fieldIds.reason}
            description={`At least ${ADMIN_EMAIL_CHANGE_REASON_MIN} characters. Kept in the audit log.`}
            error={errors.reason}
            disabled={busy}
          >
            <TextArea
              rows={3}
              value={draft.reason}
              maxLength={500}
              onChange={(event) =>
                setDraft((current) => ({ ...current, reason: event.target.value }))
              }
            />
          </Field>
        </form>
      ) : null}
    </StaffDialog>
  );
}
