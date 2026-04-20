"use client";

import { updateSubmissionAction } from "@/lib/actions/submissions";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { updateSubmissionFormData } from "./submission-form-data";
import { type NewSubmissionFormValues, newSubmissionFormSchema } from "./submission-form-schema";

export function useUpdateSubmissionController(
  submissionId: string,
  initial: NewSubmissionFormValues,
): FormController<NewSubmissionFormValues> {
  const [pending, startTransition] = useTransition();
  const form = useForm<NewSubmissionFormValues>({
    resolver: zodResolver(newSubmissionFormSchema),
    defaultValues: initial,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await updateSubmissionAction(updateSubmissionFormData(submissionId, values));
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
  };
}
