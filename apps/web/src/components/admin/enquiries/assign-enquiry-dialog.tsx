"use client";

import type { EnquiryAssignee } from "@/lib/data/http/admin-enquiries.schema";
import { EnumSelect, Field, StaffButton, StaffDialog } from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import { EnquiryWriteFailureNotice } from "./enquiry-write-failure";
import type { EnquiryWriteFailure } from "./enquiry-write-failure";
import { type EnquiryWriteResult, type EnquiryWrites, failureOf } from "./use-enquiry-writes";

const NOBODY = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  assignedToUserId: string | null;
  assignees: EnquiryAssignee[];
  viewerId: string;
  submit: EnquiryWrites["patch"];
  onReload: () => void;
  onDone: (result: Extract<EnquiryWriteResult, { ok: true }>, assignedTo: string | null) => void;
};

/**
 * Hands the enquiry to a colleague, takes it back, or leaves it with nobody for client services
 * to route. The button says what will happen.
 */
export function AssignEnquiryDialog({
  open,
  onOpenChange,
  reference,
  assignedToUserId,
  assignees,
  viewerId,
  submit,
  onReload,
  onDone,
}: Props) {
  const fieldId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(assignedToUserId ?? NOBODY);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<EnquiryWriteFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(assignedToUserId ?? NOBODY);
    setFailure(null);
  }, [open, assignedToUserId]);

  const options = [
    { value: NOBODY, label: "Nobody (unassigned)" },
    ...assignees.map((person) => ({
      value: person.id,
      label: person.id === viewerId ? `${person.name} (you)` : person.name,
    })),
  ];
  const changed = value !== (assignedToUserId ?? NOBODY);

  async function proceed() {
    setBusy(true);
    setFailure(null);
    const target = value === NOBODY ? null : value;
    const result = await submit({ assignedToUserId: target });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(result, target);
    } else {
      setFailure(failureOf(result));
    }
  }

  const assigning = value !== NOBODY;
  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      initialFocusRef={cancelRef}
      title={`Assign ${reference}`}
      description="The person you choose sees it in Assigned to me."
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={busy}
            {...(changed ? {} : { disabledReason: "Choose a different person first." })}
            onClick={() => void proceed()}
          >
            {assigning ? "Assign" : "Unassign"}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <EnquiryWriteFailureNotice
            failure={failure}
            title="The enquiry wasn't assigned"
            onReload={onReload}
          />
        ) : null}
        <Field label="Assign to" id={fieldId}>
          <EnumSelect value={value} options={options} disabled={busy} onValueChange={setValue} />
        </Field>
      </div>
    </StaffDialog>
  );
}
