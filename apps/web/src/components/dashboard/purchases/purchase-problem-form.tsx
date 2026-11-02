"use client";

import { useActionForm } from "@/lib/forms/use-action-form";
import { useFormErrorSummary } from "@/lib/forms/use-form-error-summary";
import {
  PURCHASE_PROBLEM_CATEGORY_OPTIONS,
  PURCHASE_PROBLEM_FIELD_IDS,
  PURCHASE_PROBLEM_MESSAGE_MAX,
  type PurchaseProblemFormValues,
  purchaseProblemFormSchema,
} from "@/lib/purchases/purchase-problem";
import { reportPurchaseProblemAction } from "@/lib/purchases/purchase.actions";
import {
  Button,
  ButtonLink,
  ErrorSummary,
  Field,
  NativeSelect,
  Notice,
  TextArea,
} from "@auction/ui/lax";
import Link from "next/link";
import { useState } from "react";
import { Controller } from "react-hook-form";

/** Sent: the purchase now shows "Problem reported" with this reference. */
function Sent({ reference, purchaseHref }: { reference: string; purchaseHref: string }) {
  return (
    <Notice
      tone="success"
      title="Problem reported"
      actions={
        <ButtonLink Link={Link} href={purchaseHref} variant="secondary">
          Back to the purchase
        </ButtonLink>
      }
    >
      Your reference is {reference}. Our client services team will reply by email within two
      business days.
    </Notice>
  );
}

/**
 * "Report a problem" for one paid purchase: what it is about and what happened. The report goes to
 * our client services team, and the purchase then shows its reference.
 */
export function PurchaseProblemForm({
  lotId,
  purchaseHref,
}: {
  lotId: string;
  purchaseHref: string;
}) {
  const [reference, setReference] = useState<string | null>(null);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: purchaseProblemFormSchema,
    defaultValues: { category: "" as PurchaseProblemFormValues["category"], message: "" },
    action: (values) => reportPurchaseProblemAction(lotId, values),
    onSuccess: (data) => setReference(data?.reference ?? ""),
    formOptions: { reValidateMode: "onBlur", shouldFocusError: false },
    focusInvalidField: false,
    toastFailure: false,
  });
  const summary = useFormErrorSummary(form, PURCHASE_PROBLEM_FIELD_IDS);
  const errors = form.formState.errors;

  if (reference !== null) return <Sent reference={reference} purchaseHref={purchaseHref} />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[520px] flex-col gap-5">
      <ErrorSummary errors={summary.errors} focusKey={summary.focusKey} />
      {rootError ? (
        <Notice tone="danger" alert title="We couldn't send your report">
          {rootError}
        </Notice>
      ) : null}

      <Field
        label="What is it about?"
        id={PURCHASE_PROBLEM_FIELD_IDS.category}
        error={errors.category?.message}
      >
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <NativeSelect
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={[{ value: "", label: "Choose one" }, ...PURCHASE_PROBLEM_CATEGORY_OPTIONS]}
            />
          )}
        />
      </Field>

      <Field
        label="What happened?"
        description="Include anything that helps us look into it, such as when you noticed it."
        id={PURCHASE_PROBLEM_FIELD_IDS.message}
        error={errors.message?.message}
      >
        <TextArea rows={6} maxLength={PURCHASE_PROBLEM_MESSAGE_MAX} {...form.register("message")} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send report"}
        </Button>
        <ButtonLink Link={Link} href={purchaseHref} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
