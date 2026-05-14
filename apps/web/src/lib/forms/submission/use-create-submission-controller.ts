"use client";

import { createSubmissionFromValuesAction } from "@/lib/actions/submissions";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { notify } from "@/lib/ui/notify";
import {
  type ItemSubmissionFormValues as NewSubmissionFormValues,
  itemSubmissionFormSchema as newSubmissionFormSchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";

const defaultValues: NewSubmissionFormValues = {
  title: "",
  description: "",
  medium: "",
  dimensions: "",
  categoryIds: [],
  images: [],
  yearOfWork: "",
  isSigned: false,
  signatureNote: "",
  edition: "",
  conditionSelfReport: "",
  provenance: [],
  exhibitions: [],
  askingPrice: "",
  reservePrice: "",
  submitterNotes: "",
};

export function useCreateSubmissionController(): FormController<NewSubmissionFormValues> {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<NewSubmissionFormValues>({
    resolver: zodResolver(newSubmissionFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await createSubmissionFromValuesAction(values);
      if (r.ok) {
        notify.success("Submission created");
        router.push(r.data?.redirectTo ?? "/dashboard/submissions");
        return;
      }
      if (r.fieldErrors) {
        for (const [key, msgs] of Object.entries(r.fieldErrors)) {
          if (msgs?.[0]) {
            form.setError(key as FieldPath<NewSubmissionFormValues>, { message: msgs[0] });
          }
        }
      } else {
        notify.error(r.error);
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
