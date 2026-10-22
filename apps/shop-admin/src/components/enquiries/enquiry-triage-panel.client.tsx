"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { SelectField } from "@/components/forms/fields";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { updateEnquiry } from "@/server/application/admin-enquiry-actions.server";
import { ENQUIRY_STATUS_LABELS, enquiryStaffName } from "@/server/domain/enquiry-inbox.vm";
import {
  ENQUIRY_STATUSES,
  type EnquiryAssignee,
  type EnquiryKind,
  type EnquiryStatus,
} from "@auction/shop-contracts";
import { Alert, AlertDescription, Button, ConfirmDialog } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = ENQUIRY_STATUSES.map((value) => ({
  value,
  label: ENQUIRY_STATUS_LABELS[value],
}));

/**
 * Status and assignee for one enquiry. Each change is saved as soon as it is made, against the
 * version the page was rendered with, so two people editing at once get a conflict rather than a
 * silent overwrite. Closing asks first because it removes the enquiry from the working lists.
 */
export function EnquiryTriagePanel({
  kind,
  id,
  version,
  status,
  assignee,
  assignees,
  currentSubject,
  senderName,
}: {
  kind: EnquiryKind;
  id: string;
  version: string;
  status: EnquiryStatus;
  assignee: EnquiryAssignee | null;
  /** Active staff who can handle enquiries. */
  assignees: EnquiryAssignee[];
  currentSubject: string;
  senderName: string;
}) {
  const router = useRouter();
  const mutation = useAdminMutation();
  const [conflict, setConflict] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  async function save(change: { status?: EnquiryStatus; assigneeSubject?: string | null }) {
    setConflict(false);
    let conflicted = false;
    const saved = await mutation.run(async () => {
      const result = await updateEnquiry({ kind, id, expectedVersion: version, ...change });
      conflicted = !result.ok && result.kind === "conflict";
      return result;
    }, "Enquiry updated");
    setConflict(conflicted);
    return saved;
  }

  // Someone who has since left the team can still be the assignee of an old enquiry.
  const staff =
    assignee && !assignees.some((member) => member.subject === assignee.subject)
      ? [assignee, ...assignees]
      : assignees;
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...staff.map((member) => ({
      value: member.subject,
      label:
        member.subject === currentSubject
          ? `${enquiryStaffName(member)} (you)`
          : enquiryStaffName(member),
    })),
  ];

  return (
    <section aria-labelledby="enquiry-handling-heading" className="flex flex-col gap-4">
      <h2 id="enquiry-handling-heading" className="text-lg font-medium text-on-surface">
        Handling
      </h2>

      {conflict ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>
              Someone else updated this enquiry while you had it open. Reload to see their changes,
              then make yours again.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConflict(false);
                router.refresh();
              }}
            >
              Reload enquiry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <SelectField
        name="status"
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        disabled={mutation.pending}
        onChange={(next) => {
          if (next === status) return;
          if (next === "closed") setConfirmClose(true);
          else void save({ status: next });
        }}
      />

      <div className="flex flex-col gap-2">
        <SelectField
          name="assignee"
          label="Assigned to"
          value={assignee?.subject ?? ""}
          options={assigneeOptions}
          disabled={mutation.pending}
          onChange={(next) => void save({ assigneeSubject: next === "" ? null : next })}
        />
        {assignee?.subject !== currentSubject ? (
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={mutation.pending}
            onClick={() => void save({ assigneeSubject: currentSubject })}
          >
            Assign to me
          </Button>
        ) : null}
      </div>

      {conflict ? null : (
        <AdminMutationFeedback
          message={mutation.message}
          stepUpRequired={mutation.stepUpRequired}
          stepUpHref={mutation.stepUpHref}
        />
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this enquiry?"
        body={`The enquiry from ${senderName} moves to Closed and no longer counts towards the number beside Enquiries. You can reopen it by changing the status.`}
        confirmLabel="Close enquiry"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          await save({ status: "closed" });
          setConfirmClose(false);
        }}
      />
    </section>
  );
}
