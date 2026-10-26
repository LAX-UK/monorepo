"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  legalEntityArchiveAction,
  legalEntityRejectAction,
} from "@/lib/admin/legal-entity-lifecycle.actions";
import { Field, StaffButton, TextArea } from "@auction/staff-ui";
import { useId, useState } from "react";

const REASON_MIN = 3;

/** The lifecycle actions redirect back to the page with their result, so a return means done. */
async function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  try {
    await action(fd);
    return { ok: true as const };
  } catch (e) {
    // A redirect is how these actions finish; Next handles it, so only real errors land here.
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "That did not go through.",
    };
  }
}

type FormProps = {
  legalEntityId: string;
  displayName: string;
};

function ReasonField({
  id,
  reason,
  onChange,
  error,
  description,
}: {
  id: string;
  reason: string;
  onChange: (value: string) => void;
  error: string | null;
  description: string;
}) {
  return (
    <Field id={id} label="Reason" description={description} error={error}>
      <TextArea
        value={reason}
        maxLength={4000}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/**
 * Rejecting an organisation. The reason is kept in the audit log; the question names the entity
 * and what rejecting does before anything is sent.
 */
export function LegalEntityRejectForm({ legalEntityId, displayName }: FormProps) {
  const confirm = useStaffConfirm();
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ask = () => {
    if (reason.trim().length < REASON_MIN) {
      setError(`Enter a reason of at least ${REASON_MIN} characters.`);
      document.getElementById(id)?.focus();
      return;
    }
    setError(null);
    confirm.ask({
      title: `Reject ${displayName}?`,
      description:
        "The organisation is marked as rejected and cannot sell. The reason is kept in the audit log.",
      confirmLabel: "Reject organisation",
      cancelLabel: "Keep as it is",
      tone: "danger",
      run: () =>
        run(legalEntityRejectAction, {
          legalEntityId,
          reason: reason.trim(),
          confirmationPhrase: "REJECT",
        }),
      success: `${displayName} rejected`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ReasonField
        id={id}
        reason={reason}
        onChange={(value) => {
          setReason(value);
          if (error && value.trim().length >= REASON_MIN) setError(null);
        }}
        error={error}
        description="Why this organisation is rejected. Kept in the audit log."
      />
      <div>
        <StaffButton variant="danger-secondary" onClick={ask}>
          Reject organisation
        </StaffButton>
      </div>
      {confirm.dialog}
    </div>
  );
}

/**
 * Archiving an organisation, a permanent end state, so the person types its name to confirm and
 * gives a reason for the audit log.
 */
export function LegalEntityArchiveForm({ legalEntityId, displayName }: FormProps) {
  const confirm = useStaffConfirm();
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ask = () => {
    if (reason.trim().length < REASON_MIN) {
      setError(`Enter a reason of at least ${REASON_MIN} characters.`);
      document.getElementById(id)?.focus();
      return;
    }
    setError(null);
    confirm.ask({
      title: `Archive ${displayName}?`,
      description:
        "Archiving is permanent: the organisation cannot be reopened. Type its name to confirm.",
      confirmLabel: "Archive organisation",
      cancelLabel: "Keep organisation",
      tone: "danger",
      typedConfirmation: displayName,
      run: () =>
        run(legalEntityArchiveAction, {
          legalEntityId,
          reason: reason.trim(),
          confirmationPhrase: `ARCHIVE ${displayName}`,
        }),
      success: `${displayName} archived`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ReasonField
        id={id}
        reason={reason}
        onChange={(value) => {
          setReason(value);
          if (error && value.trim().length >= REASON_MIN) setError(null);
        }}
        error={error}
        description="Why this organisation is archived. Kept in the audit log."
      />
      <div>
        <StaffButton variant="danger-secondary" onClick={ask}>
          Archive organisation
        </StaffButton>
      </div>
      {confirm.dialog}
    </div>
  );
}
