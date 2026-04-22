"use client";

import { updateProfileNameFromValuesAction } from "@/lib/actions/profile";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  type ProfileDisplayNameFormValues,
  profileDisplayNameFormSchema,
} from "./profile-settings-schema";

export function useProfileNameController(
  initialName: string,
): FormController<ProfileDisplayNameFormValues> {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<ProfileDisplayNameFormValues>({
    resolver: zodResolver(profileDisplayNameFormSchema),
    defaultValues: { name: initialName },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await updateProfileNameFromValuesAction({ name: values.name.trim() });
      if (r.ok) {
        toast.success("Profile updated");
        router.refresh();
        return;
      }
      if (r.fieldErrors) {
        for (const [key, msgs] of Object.entries(r.fieldErrors)) {
          if (msgs?.[0]) {
            form.setError(key as FieldPath<ProfileDisplayNameFormValues>, { message: msgs[0] });
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
