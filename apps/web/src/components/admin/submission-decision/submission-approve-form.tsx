"use client";

import {
  StaffMoneyField,
  StaffPercentField,
  StaffTextAreaField,
} from "@/components/admin/forms/staff-form-fields";
import {
  type AcceptProposalFormValues,
  EMPTY_ACCEPT_PROPOSAL,
  acceptProposalFormSchema,
} from "@/lib/admin/submissions/accept-proposal-form";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { FormActions, Notice, Section, StaffButton } from "@auction/staff-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, type RefObject, useEffect } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { SUBMISSION_APPROVE_FORM_ID } from "./form-ids";

type Props = {
  pending: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (
    values: AcceptProposalFormValues,
    form: UseFormReturn<AcceptProposalFormValues>,
  ) => void;
  /** Reports whether anything is typed, so the page can ask before it is lost. */
  onDirtyChange: (dirty: boolean) => void;
  /** Why the work cannot be accepted yet, with where staff can follow it up. */
  blocked?: { title: string; body: string; actions: ReactNode } | null;
};

/**
 * Accepting a submission, with the estimate and terms the seller is asked to agree to. The
 * seller accepts them in the consignment agreement before the lot can be catalogued.
 */
export function SubmissionApproveForm({
  pending,
  formRef,
  onSubmit,
  onDirtyChange,
  blocked = null,
}: Props) {
  const form = useForm<AcceptProposalFormValues>({
    resolver: zodResolver(acceptProposalFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: EMPTY_ACCEPT_PROPOSAL,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const failure = form.formState.errors.root?.server?.message;
  const fieldProps = { control: form.control, formId: SUBMISSION_APPROVE_FORM_ID } as const;

  return (
    <Section
      title="Accept and propose terms"
      description="The seller is told it was accepted and asked to accept the consignment agreement with these terms. You create the draft lot once they accept."
    >
      <form
        id={SUBMISSION_APPROVE_FORM_ID}
        ref={formRef}
        noValidate
        aria-label="Accept and propose terms"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        {blocked ? (
          <Notice tone="warning" title={blocked.title} actions={blocked.actions}>
            {blocked.body}
          </Notice>
        ) : null}
        {failure ? (
          <Notice tone="danger" alert title="It was not accepted">
            {failure}
          </Notice>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <StaffMoneyField
            {...fieldProps}
            name="estimateLow"
            label="Low estimate"
            optional
            disabled={pending}
          />
          <StaffMoneyField
            {...fieldProps}
            name="estimateHigh"
            label="High estimate"
            optional
            disabled={pending}
          />
          <StaffMoneyField
            {...fieldProps}
            name="reservePrice"
            label="Reserve"
            optional
            disabled={pending}
          />
          <StaffPercentField
            {...fieldProps}
            name="commissionRate"
            label="Seller's commission"
            optional
            disabled={pending}
          />
        </div>
        <StaffTextAreaField
          {...fieldProps}
          name="reviewNotes"
          label="Internal review notes"
          description="Only staff see these."
          optional
          rows={3}
          disabled={pending}
        />
        <FormActions>
          <StaffButton
            type="submit"
            variant="primary"
            loading={pending}
            disabled={Boolean(blocked)}
          >
            Accept and send terms
          </StaffButton>
        </FormActions>
      </form>
    </Section>
  );
}
