"use client";

import type { PurchaseProblemAssignee } from "@/lib/data/http/admin-purchase-problems.schema";
import { EnumSelect, Field, StaffButton, StaffDialog } from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import {
  type PurchaseProblemWriteFailure,
  PurchaseProblemWriteFailureNotice,
} from "./purchase-problem-write-failure";
import {
  type PurchaseProblemWriteResult,
  type PurchaseProblemWrites,
  failureOf,
} from "./use-purchase-problem-writes";

const NOBODY = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  assignedToUserId: string | null;
  assignees: PurchaseProblemAssignee[];
  viewerId: string;
  submit: PurchaseProblemWrites["patch"];
  onReload: () => void;
  onDone: (
    result: Extract<PurchaseProblemWriteResult, { ok: true }>,
    assignedTo: string | null,
  ) => void;
};

/** Hands the report to a colleague, takes it back, or leaves it with nobody. */
export function AssignPurchaseProblemDialog({
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
  const [failure, setFailure] = useState<PurchaseProblemWriteFailure | null>(null);

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

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      initialFocusRef={cancelRef}
      title={`Assign ${reference}`}
      description="The person you choose owns the report and follows it up with the buyer."
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
            {value === NOBODY ? "Unassign" : "Assign"}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <PurchaseProblemWriteFailureNotice
            failure={failure}
            title="The report wasn't assigned"
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
