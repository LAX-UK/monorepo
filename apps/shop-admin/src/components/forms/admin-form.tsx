"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import type { AdminMutation } from "@/components/use-admin-mutation";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
import { LoadingButton } from "@auction/ui";
import { type ReactNode, useId } from "react";
import { FormErrorSummary } from "./form-error-summary";
import { FormScopeProvider } from "./form-field";

type AdminFormProps = {
  title: string;
  mutation: AdminMutation;
  errors: FieldErrors;
  submitLabel: string;
  /** Validates, then either runs the mutation or opens its confirmation. */
  onSubmit: () => void;
  /** Extra copy under the title, before the fields. */
  description?: ReactNode;
  /** Shown after the submit button, e.g. what happens once the action succeeds. */
  footnote?: ReactNode;
  /** A second button beside submit for forms with two outcomes, such as approve and decline. */
  secondaryAction?: ReactNode;
  children: ReactNode;
};

/** Titled form for one staff action: fields, error summary, submit button and inline failure. */
export function AdminForm({
  title,
  mutation,
  errors,
  submitLabel,
  onSubmit,
  description,
  footnote,
  secondaryAction,
  children,
}: AdminFormProps) {
  const scope = useId();

  return (
    <section
      aria-labelledby={`${scope}-title`}
      className="space-y-3 rounded-md border border-border-hairline p-4"
    >
      <h3 id={`${scope}-title`} className="text-sm font-medium">
        {title}
      </h3>
      {description}
      <FormScopeProvider value={scope}>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {hasFieldErrors(errors) ? <FormErrorSummary scope={scope} errors={errors} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          <div className="flex flex-wrap items-center gap-2">
            <LoadingButton type="submit" loading={mutation.pending} loadingLabel="Working…">
              {submitLabel}
            </LoadingButton>
            {secondaryAction}
          </div>
          <AdminMutationFeedback
            message={mutation.message}
            stepUpRequired={mutation.stepUpRequired}
            stepUpHref={mutation.stepUpHref}
          />
          {footnote}
        </form>
      </FormScopeProvider>
    </section>
  );
}
