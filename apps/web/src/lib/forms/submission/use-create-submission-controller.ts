"use client";

import { createSubmissionAction } from "@/lib/actions/submissions";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { createSubmissionFormData } from "./submission-form-data";
import { type NewSubmissionFormValues, newSubmissionFormSchema } from "./submission-form-schema";

const defaultValues: NewSubmissionFormValues = {
  title: "",
  description: "",
  medium: "",
  dimensions: "",
  categoryId: "",
  imagesText: "",
  askingPrice: "",
  reservePrice: "",
  submitterNotes: "",
};

export function useCreateSubmissionController(): FormController<NewSubmissionFormValues> {
  const [pending, startTransition] = useTransition();
  const form = useForm<NewSubmissionFormValues>({
    resolver: zodResolver(newSubmissionFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await createSubmissionAction(createSubmissionFormData(values));
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
  };
}
