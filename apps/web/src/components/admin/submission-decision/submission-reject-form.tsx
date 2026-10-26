"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { FormActions, Section, StaffButton } from "@auction/staff-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { SUBMISSION_REJECT_FORM_ID } from "./form-ids";
import { type RejectFormValues, rejectFormSchema } from "./use-submission-decision-actions";

type Props = {
  pending: boolean;
  /** Asks the person to confirm, then rejects. */
  onSubmit: (values: RejectFormValues) => void;
  /** Reports whether anything is typed, so the page can ask before it is lost. */
  onDirtyChange: (dirty: boolean) => void;
};

/**
 * Rejecting a submission: the reason goes to the seller as written, so it is required and shows
 * its error beside the field. The rejection itself is confirmed before it is sent.
 */
export function SubmissionRejectForm({ pending, onSubmit, onDirtyChange }: Props) {
  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: { rejectionReason: "", reviewNotes: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  return (
    <Section
      title="Reject"
      description="The seller is emailed your reason. A rejected submission cannot be reopened."
    >
      <form
        id={SUBMISSION_REJECT_FORM_ID}
        noValidate
        aria-label="Reject submission"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
      >
        <StaffTextAreaField
          control={form.control}
          formId={SUBMISSION_REJECT_FORM_ID}
          name="rejectionReason"
          label="Reason for the seller"
          description="Sent as written. Say what they would need to change."
          rows={3}
          disabled={pending}
        />
        <StaffTextAreaField
          control={form.control}
          formId={SUBMISSION_REJECT_FORM_ID}
          name="reviewNotes"
          label="Internal notes"
          description="Only staff see these."
          optional
          rows={2}
          disabled={pending}
        />
        <FormActions>
          <StaffButton type="submit" variant="danger-secondary" loading={pending}>
            Reject submission
          </StaffButton>
        </FormActions>
      </form>
    </Section>
  );
}
