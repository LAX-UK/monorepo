"use client";

import { liftEmailBlockAction } from "@/lib/actions/admin/email-delivery";
import {
  BLOCK_COPY,
  LIFT_REASON_COPY,
  firstNameOf,
} from "@/lib/admin/email-delivery/email-delivery-copy";
import {
  type LiftDraft,
  type LiftErrors,
  type LiftField,
  initialLiftDraft,
  noteIsRequired,
  toLiftBody,
  validateLift,
} from "@/lib/admin/email-delivery/lift-email-block-form";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FieldError,
  FormErrorSummary,
  KeyValueList,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDate,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  toast,
} from "@auction/staff-ui";
import type { EmailBlockView, EmailLiftReason, EmailProviderResult } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  personName: string;
  email: string;
  block: EmailBlockView;
  /** Emails skipped while the address was blocked. */
  skippedCount: number;
  /** How the block is lifted; the server action unless a test or a review page supplies one. */
  lift?: typeof liftEmailBlockAction;
};

type Stale = { liftedAt: string | null; liftedBy: string | null };
type Done = { provider: Extract<EmailProviderResult, { status: "still_blocked" }> };

function skippedWords(count: number): string | null {
  if (count === 0) return null;
  return `${count} ${count === 1 ? "email" : "emails"} not sent while blocked. They are not resent.`;
}

/**
 * Confirms lifting a block on a person's address. It names the person and the effect first, asks
 * why, and for a complaint adds the reputation warning, a note saying where they asked and a tick
 * that it was in writing. Mistakes stay in the dialog: a missing answer on the field, a failed
 * request as a notice that says nothing changed, and a block someone else lifted first as its own
 * outcome. There is no undo, so Cancel has focus.
 */
export function LiftEmailBlockDialog({
  open,
  onOpenChange,
  userId,
  personName,
  email,
  block,
  skippedCount,
  lift = liftEmailBlockAction,
}: Props) {
  const router = useRouter();
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<LiftField, string> = {
    reason: `${ids}-reason`,
    note: `${ids}-note`,
    writtenRequest: `${ids}-written`,
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<LiftDraft>(() => initialLiftDraft(block));
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState<Stale | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, startTransition] = useTransition();

  const who = firstNameOf(personName);
  const complaint = block.writtenRequestRequired;
  const copy = BLOCK_COPY[block.reason];

  // Each opening starts clean; a closed dialog keeps nothing of the last attempt.
  useEffect(() => {
    if (!open) return;
    setDraft(initialLiftDraft(block));
    setAttempted(false);
    setFailure(null);
    setStale(null);
    setDone(null);
  }, [open, block]);

  const errors: LiftErrors = attempted ? validateLift(block, draft) : {};
  const summary = (Object.keys(errors) as LiftField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );
  const noteRequired = noteIsRequired(block, draft);

  const close = () => {
    if (!busy) onOpenChange(false);
  };

  const submit = () => {
    setAttempted(true);
    const body = toLiftBody(block, draft);
    if (!body) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await lift(userId, body);
      if (result.ok && result.data) {
        router.refresh();
        if (result.data.provider.status === "still_blocked") {
          setDone({ provider: result.data.provider });
          return;
        }
        toast.success(`Block lifted. ${who}’s next email will be sent.`);
        onOpenChange(false);
        return;
      }
      if (!result.ok && result.status === 409) {
        router.refresh();
        setStale({
          liftedAt: typeof result.meta?.liftedAt === "string" ? result.meta.liftedAt : null,
          liftedBy: typeof result.meta?.liftedBy === "string" ? result.meta.liftedBy : null,
        });
        return;
      }
      setFailure(result.ok ? "Try again in a moment." : result.error);
    });
  };

  const skipped = skippedWords(skippedCount);
  const summaryItems = [
    {
      label: "Block",
      value: (
        <span>
          {copy.name}, since <StaffDate value={block.since} withTime className="text-staff-fg" />
        </span>
      ),
    },
    { label: "Stops", value: "All email, including invoices" },
    ...(skipped ? [{ label: "Skipped", value: skipped }] : []),
  ];

  const finished = stale !== null || done !== null;
  const footer = finished ? (
    <StaffButton ref={cancelRef} variant="primary" onClick={() => onOpenChange(false)}>
      Close
    </StaffButton>
  ) : (
    <>
      <StaffButton ref={cancelRef} variant="secondary" onClick={close} disabled={busy}>
        Cancel
      </StaffButton>
      <StaffButton type="submit" form={formId} variant="primary" loading={busy}>
        {busy ? "Lifting…" : "Lift block"}
      </StaffButton>
    </>
  );

  const title = stale
    ? "This block was already lifted"
    : done
      ? `Block lifted for ${personName}`
      : complaint
        ? `Lift the complaint block for ${personName}?`
        : `Lift the email block for ${personName}?`;
  const description = finished
    ? undefined
    : complaint
      ? `${who} marked an email as spam. Only administrators can lift this.`
      : `LAX will email ${email} again, starting with the next email.`;

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={title}
      {...(description ? { description } : {})}
      footer={footer}
    >
      {stale ? (
        <Notice tone="warning" title={<StaleTitle stale={stale} />}>
          The panel now shows the current state. Nothing else changed.
        </Notice>
      ) : done ? (
        <Notice tone="warning" alert title={`Lifted here. ${done.provider.message}.`}>
          The provider keeps complaint blocks until its support team removes them, so essential
          email may still be refused. Ask engineering to follow the email deliverability runbook.
        </Notice>
      ) : (
        <form
          id={formId}
          noValidate
          aria-label={`Lift the email block for ${personName}`}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormErrorSummary errors={summary} focusKey={failedSubmits} />
          {failure ? (
            <Notice tone="danger" alert title="The block couldn’t be lifted. Nothing changed.">
              {failure}
            </Notice>
          ) : null}
          {complaint ? (
            <>
              <Notice
                tone="warning"
                title="Mailing someone who complained can hurt delivery for every client."
              >
                Mailbox providers count complaints against LAX. Lift only when {who} has asked, in
                writing, to receive email again.
              </Notice>
              <Notice tone="info" title="Alert emails stay off">
                Lifting restores invoices, receipts and account email. New-sale and artist alerts
                stay stopped until {who} turns them on in Settings › Alerts or LAX Account › Email
                alerts.
              </Notice>
            </>
          ) : null}
          <div className="rounded-staff-md border border-staff-line bg-staff-sunken px-3 py-1">
            <KeyValueList items={summaryItems} />
          </div>

          <ChoiceFieldset
            legend="Why are you lifting it?"
            id={fieldIds.reason}
            error={errors.reason}
            disabled={busy}
          >
            <StaffRadioGroup
              value={draft.reason ?? ""}
              disabled={busy}
              onValueChange={(next) =>
                setDraft((current) => ({ ...current, reason: next as EmailLiftReason }))
              }
            >
              {block.liftReasons.map((reason) => (
                <ChoiceRow
                  key={reason}
                  htmlFor={`${ids}-reason-${reason}`}
                  label={LIFT_REASON_COPY[reason].label}
                  {...(LIFT_REASON_COPY[reason].hint
                    ? { description: LIFT_REASON_COPY[reason].hint }
                    : {})}
                  disabled={busy}
                  control={
                    <StaffRadio id={`${ids}-reason-${reason}`} value={reason} disabled={busy} />
                  }
                />
              ))}
            </StaffRadioGroup>
          </ChoiceFieldset>

          <Field
            label={complaint ? "Where they asked" : noteRequired ? "Note" : "Note (optional)"}
            id={fieldIds.note}
            description={
              complaint
                ? "For example: email to client services on 2 Nov, enquiry reference."
                : `For example: ${who} set up the mailbox again on the same address.`
            }
            error={errors.note}
            disabled={busy}
          >
            <TextArea
              rows={3}
              value={draft.note}
              maxLength={1000}
              onChange={(event) =>
                setDraft((current) => ({ ...current, note: event.target.value }))
              }
            />
          </Field>

          {complaint ? (
            <div className="flex flex-col gap-1">
              <ChoiceRow
                htmlFor={fieldIds.writtenRequest}
                label={`${who} asked us in writing to email them again`}
                disabled={busy}
                control={
                  <StaffCheckbox
                    id={fieldIds.writtenRequest}
                    checked={draft.writtenRequest}
                    disabled={busy}
                    aria-invalid={errors.writtenRequest ? true : undefined}
                    aria-describedby={
                      errors.writtenRequest ? `${fieldIds.writtenRequest}-error` : undefined
                    }
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, writtenRequest: checked === true }))
                    }
                  />
                }
              />
              {errors.writtenRequest ? (
                <FieldError id={`${fieldIds.writtenRequest}-error`}>
                  {errors.writtenRequest}
                </FieldError>
              ) : null}
            </div>
          ) : null}
          {complaint ? (
            <p className="text-staff-sm text-staff-muted">
              The email provider keeps its own complaint block, which only its support team can
              clear. Until then it may still refuse mail to this address. The result will say.
            </p>
          ) : null}
        </form>
      )}
    </StaffDialog>
  );
}

function StaleTitle({ stale }: { stale: Stale }) {
  const by = stale.liftedBy ? `${stale.liftedBy} lifted it` : "It was lifted";
  return stale.liftedAt ? (
    <>
      {by} at <StaffDate value={stale.liftedAt} withTime className="text-inherit" />.
    </>
  ) : (
    <>{by}.</>
  );
}
