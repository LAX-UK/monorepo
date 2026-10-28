"use client";

import { StaffMoneyField, StaffPercentField } from "@/components/admin/forms/staff-form-fields";
import {
  EMPTY_TERMS,
  type TermsFormValues,
  termsFormSchema,
} from "@/lib/admin/submissions/accept-proposal-form";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { FormActions, Notice, StaffButton } from "@auction/staff-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormReturn, useForm } from "react-hook-form";
import { SUBMISSION_TERMS_FORM_ID } from "./form-ids";

type Props = {
  pending: boolean;
  onSubmit: (values: TermsFormValues, form: UseFormReturn<TermsFormValues>) => void;
};

/** The estimate and seller's commission the seller is asked to accept, with an optional reserve. */
export function SubmissionTermsForm({ pending, onSubmit }: Props) {
  const form = useForm<TermsFormValues>({
    resolver: zodResolver(termsFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: EMPTY_TERMS,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const failure = form.formState.errors.root?.server?.message;
  const fieldProps = { control: form.control, formId: SUBMISSION_TERMS_FORM_ID } as const;

  return (
    <form
      id={SUBMISSION_TERMS_FORM_ID}
      noValidate
      aria-label="Add the estimate and terms"
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
    >
      {failure ? (
        <Notice tone="danger" alert title="The terms were not sent">
          {failure}
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <StaffMoneyField
          {...fieldProps}
          name="estimateLow"
          label="Low estimate"
          disabled={pending}
        />
        <StaffMoneyField
          {...fieldProps}
          name="estimateHigh"
          label="High estimate"
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
          disabled={pending}
        />
      </div>
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={pending}>
          Send the terms to the seller
        </StaffButton>
      </FormActions>
    </form>
  );
}
