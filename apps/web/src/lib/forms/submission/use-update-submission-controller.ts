"use client";

import { updateSubmissionFromValuesAction } from "@/lib/actions/submissions";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import { type NewSubmissionFormValues, newSubmissionFormSchema } from "./submission-form-schema";

export function useUpdateSubmissionController(
  submissionId: string,
  initial: NewSubmissionFormValues,
): FormController<NewSubmissionFormValues> {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<NewSubmissionFormValues>({
    resolver: zodResolver(newSubmissionFormSchema),
    defaultValues: initial,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await updateSubmissionFromValuesAction(submissionId, values);
      if (r.ok) {
        toast.success("Saved");
        router.push(r.data?.redirectTo ?? `/dashboard/submissions/${submissionId}`);
        return;
      }
      if (r.fieldErrors) {
        for (const [key, msgs] of Object.entries(r.fieldErrors)) {
          if (msgs?.[0]) {
            form.setError(key as FieldPath<NewSubmissionFormValues>, { message: msgs[0] });
          }
        }
      } else {
        toast.error(r.error);
      }
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
  };
}
