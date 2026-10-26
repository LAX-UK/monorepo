"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminReviewArtistResultAction } from "@/lib/actions/admin";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { notify } from "@/lib/ui/notify";
import {
  Field,
  FormActions,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
  TextArea,
} from "@auction/staff-ui";
import type { ArtistStatus } from "@auction/types";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  artistId: string;
  /** The profile's name, for the questions the page asks. */
  displayName?: string;
  currentStatus: ArtistStatus | undefined;
};

/**
 * Approves or rejects a pending artist profile. Approving makes it visible and usable for
 * attribution; rejecting asks first, and the reason is sent to the profile's owner. Review notes
 * stay with staff. A refusal from the server shows in the panel, with what was typed kept.
 */
export function AdminArtistReviewPanel({ artistId, displayName, currentStatus }: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const isPending = currentStatus === "pending" || currentStatus === undefined;
  const name = displayName ?? "this profile";

  if (!isPending) {
    const status = currentStatus ? staffStatus("artist", currentStatus) : null;
    return (
      <Section title="Review">
        <p className="flex flex-wrap items-center gap-2 text-staff-sm text-staff-muted">
          This profile has already been reviewed.
          {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
          You can change its status from Edit artist.
        </p>
      </Section>
    );
  }

  const input = (decision: "approved" | "rejected") => {
    const body: {
      decision: "approved" | "rejected";
      reviewNotes?: string;
      rejectionReason?: string;
    } = { decision };
    if (notes.trim()) body.reviewNotes = notes.trim();
    if (decision === "rejected" && rejectionReason.trim()) {
      body.rejectionReason = rejectionReason.trim();
    }
    return body;
  };

  const approve = () => {
    setFailure(null);
    startTransition(async () => {
      const result = await adminReviewArtistResultAction(artistId, input("approved"));
      if (result.ok) {
        notify.success(`${name} approved`);
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  const reject = () =>
    confirm.ask({
      title: `Reject ${name}?`,
      description:
        "The profile stays hidden and cannot be used to attribute lots. The reason below goes to the profile's owner.",
      confirmLabel: "Reject profile",
      cancelLabel: "Keep reviewing",
      tone: "danger",
      run: () => adminReviewArtistResultAction(artistId, input("rejected")),
      success: `${name} rejected`,
    });

  return (
    <Section
      title="Review"
      description="Approve to make this profile public and available for attribution. Reject to keep it hidden."
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="The review was not saved">
            {failure}
          </Notice>
        ) : null}
        <Field label="Review notes" optional description="Internal. Only staff see these.">
          <TextArea
            rows={3}
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <Field
          label="Reason for rejecting"
          optional
          description="Sent to the profile's owner if you reject it."
        >
          <TextArea
            rows={2}
            value={rejectionReason}
            disabled={pending}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
        </Field>
        <FormActions>
          <StaffButton
            variant="danger-secondary"
            icon={<X aria-hidden />}
            disabled={pending}
            onClick={reject}
          >
            Reject profile
          </StaffButton>
          <StaffButton
            variant="primary"
            icon={<Check aria-hidden />}
            loading={pending}
            onClick={approve}
          >
            Approve profile
          </StaffButton>
        </FormActions>
      </div>
      {confirm.dialog}
    </Section>
  );
}
