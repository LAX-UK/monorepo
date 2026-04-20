"use client";

import { updateProfileNameAction } from "@/lib/actions/profile";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { profileNameToFormData } from "./profile-form-data";
import {
  type ProfileDisplayNameFormValues,
  profileDisplayNameFormSchema,
} from "./profile-settings-schema";

export function useProfileNameController(
  initialName: string,
): FormController<ProfileDisplayNameFormValues> {
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileDisplayNameFormValues>({
    resolver: zodResolver(profileDisplayNameFormSchema),
    defaultValues: { name: initialName },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await updateProfileNameAction(profileNameToFormData(values));
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
  };
}
