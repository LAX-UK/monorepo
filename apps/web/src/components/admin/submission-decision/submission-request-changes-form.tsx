"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { FormActions, Notice, Section, StaffButton } from "@auction/staff-ui";
import {
  type RequestSubmissionChangesBody,
  requestSubmissionChangesBodySchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { SUBMISSION_REQUEST_CHANGES_FORM_ID } from "./form-ids";

type Props = {
  pending: boolean;
  onSubmit: (
    values: RequestSubmissionChangesBody,
    form: UseFormReturn<RequestSubmissionChangesBody>,
  ) => void;
  onDirtyChange: (dirty: boolean) => void;
};

/**
 * Asking the seller for changes instead of deciding now. The note goes to the seller as written;
 * they edit the same submission and send it back to the review queue.
 */
export function SubmissionRequestChangesForm({ pending, onSubmit, onDirtyChange }: Props) {
  const form = useForm<RequestSubmissionChangesBody>({
    resolver: zodResolver(requestSubmissionChangesBodySchema, STAFF_PARSE_PARAMS),
    defaultValues: { note: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const failure = form.formState.errors.root?.server?.message;

  return (
    <Section
      title="Ask for changes"
      description="The seller reads your note, edits the submission and sends it back for review."
    >
      <form
        id={SUBMISSION_REQUEST_CHANGES_FORM_ID}
        noValidate
        aria-label="Ask for changes"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        {failure ? (
          <Notice tone="danger" alert title="The seller was not asked">
            {failure}
          </Notice>
        ) : null}
        <StaffTextAreaField
          control={form.control}
          formId={SUBMISSION_REQUEST_CHANGES_FORM_ID}
          name="note"
          label="Note to the seller"
          description="Sent to the seller as written."
          rows={3}
          disabled={pending}
        />
        <FormActions>
          <StaffButton type="submit" variant="secondary" loading={pending}>
            Ask for changes
          </StaffButton>
        </FormActions>
      </form>
    </Section>
  );
}
