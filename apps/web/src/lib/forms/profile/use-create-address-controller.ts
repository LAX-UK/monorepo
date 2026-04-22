"use client";

import { createAddressFromValuesAction } from "@/lib/actions/profile";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import { type NewAddressFormValues, newAddressFormSchema } from "./profile-settings-schema";

const defaultValues: NewAddressFormValues = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  isDefault: false,
};

export function useCreateAddressController(): FormController<NewAddressFormValues> {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<NewAddressFormValues>({
    resolver: zodResolver(newAddressFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await createAddressFromValuesAction({
        label: values.label.trim(),
        line1: values.line1.trim(),
        line2: (values.line2 ?? "").trim() || undefined,
        city: values.city.trim(),
        state: (values.state ?? "").trim() || undefined,
        postalCode: values.postalCode.trim(),
        country: values.country.trim(),
        isDefault: values.isDefault,
      });
      if (r.ok) {
        toast.success("Address added");
        form.reset(defaultValues);
        router.refresh();
        return;
      }
      if (r.fieldErrors) {
        for (const [key, msgs] of Object.entries(r.fieldErrors)) {
          if (msgs?.[0]) {
            form.setError(key as FieldPath<NewAddressFormValues>, { message: msgs[0] });
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
