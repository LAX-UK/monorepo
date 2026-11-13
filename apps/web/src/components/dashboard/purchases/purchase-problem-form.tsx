"use client";

import { useActionForm } from "@/lib/forms/use-action-form";
import { useFormErrorSummary } from "@/lib/forms/use-form-error-summary";
import { zodFormResolver } from "@/lib/forms/zod-form-resolver";
import {
  PURCHASE_PROBLEM_CATEGORY_OPTIONS,
  PURCHASE_PROBLEM_FIELD_IDS,
  PURCHASE_PROBLEM_MESSAGE_MAX,
  type PurchaseProblemFormValues,
  purchaseProblemFormSchema,
} from "@/lib/purchases/purchase-problem";
import { reportPurchaseProblemAction } from "@/lib/purchases/purchase.actions";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { ErrorSummary } from "@auction/ui/lax/error-summary";
import { Field } from "@auction/ui/lax/field";
import { TextArea } from "@auction/ui/lax/input";
import { NativeSelect } from "@auction/ui/lax/native-select";
import { Notice } from "@auction/ui/lax/notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";

/**
 * "Report a problem" for one paid purchase: what it is about and what happened. The report goes to
 * our client services team, and the purchase then shows "Problem reported" with its reference.
 */
export function PurchaseProblemForm({
  lotId,
  purchaseHref,
}: {
  lotId: string;
  purchaseHref: string;
}) {
  const router = useRouter();
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    resolver: zodFormResolver(purchaseProblemFormSchema),
    defaultValues: { category: "" as PurchaseProblemFormValues["category"], message: "" },
    action: (values) => reportPurchaseProblemAction(lotId, values),
    // The purchase page shows "Problem reported" with the reference.
    onSuccess: () => router.push(purchaseHref),
    formOptions: { reValidateMode: "onBlur", shouldFocusError: false },
    focusInvalidField: false,
    toastFailure: false,
  });
  const summary = useFormErrorSummary(form, PURCHASE_PROBLEM_FIELD_IDS);
  const errors = form.formState.errors;

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
