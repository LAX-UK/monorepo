"use client";

import { createAddressAction } from "@/lib/actions/profile";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { newAddressToFormData } from "./profile-form-data";
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
  const form = useForm<NewAddressFormValues>({
    resolver: zodResolver(newAddressFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await createAddressAction(newAddressToFormData(values));
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
  };
}
