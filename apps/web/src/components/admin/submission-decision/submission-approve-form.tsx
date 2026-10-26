"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { FormActions, Notice, Section, StaffButton } from "@auction/staff-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { type RefObject, useEffect } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { SUBMISSION_APPROVE_FORM_ID } from "./form-ids";
import { type ApproveFormValues, approveFormSchema } from "./use-submission-decision-actions";

type Props = {
  pending: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => void;
  /** Reports whether anything is typed, so the page can ask before it is lost. */
  onDirtyChange: (dirty: boolean) => void;
};

/** Accepting a submission for cataloguing, with optional notes that stay with staff. */
export function SubmissionApproveForm({ pending, formRef, onSubmit, onDirtyChange }: Props) {
  const form = useForm<ApproveFormValues>({
    resolver: zodResolver(approveFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: { reviewNotes: "", artistId: null },
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
      title="Accept for cataloguing"
      description="The seller is told it was accepted. You create the draft lot next."
    >
      <form
        id={SUBMISSION_APPROVE_FORM_ID}
        ref={formRef}
        noValidate
        aria-label="Accept for cataloguing"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        {failure ? (
          <Notice tone="danger" alert title="It was not accepted">
            {failure}
          </Notice>
        ) : null}
        <StaffTextAreaField
          control={form.control}
          formId={SUBMISSION_APPROVE_FORM_ID}
          name="reviewNotes"
          label="Internal review notes"
          description="Only staff see these."
          optional
          rows={3}
          disabled={pending}
        />
        <FormActions>
          <StaffButton type="submit" variant="primary" loading={pending}>
            Accept for cataloguing
          </StaffButton>
        </FormActions>
      </form>
    </Section>
  );
}
