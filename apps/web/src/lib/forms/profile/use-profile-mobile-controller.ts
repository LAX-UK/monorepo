"use client";

import { updateProfilePhoneFromValuesAction } from "@/lib/actions/profile";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { notify } from "@/lib/ui/notify";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CountryCode } from "libphonenumber-js";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import {
  type ProfilePhoneFormValues,
  profilePhoneFormSchema,
  splitE164ForForm,
} from "./profile-settings-schema";

export function useProfileMobileController(
  initialMobile: string | null,
  initialMobileCountry: string | null,
  defaultCountry: CountryCode,
): FormController<ProfilePhoneFormValues> {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<ProfilePhoneFormValues>({
    resolver: zodResolver(profilePhoneFormSchema),
    defaultValues: {
      phone: splitE164ForForm(
        initialMobile,
        defaultCountry,
        initialMobileCountry ?? defaultCountry,
      ),
    },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const trimmed = values.phone.number.trim();
      const r = await updateProfilePhoneFromValuesAction(
        trimmed.length === 0 ? { phone: null, mobile: null } : { phone: values.phone },
      );
      if (r.ok) {
        notify.success(trimmed.length === 0 ? "Phone number removed" : "Phone number saved");
        router.refresh();
        return;
      }
      if (r.fieldErrors) {
        for (const [key, msgs] of Object.entries(r.fieldErrors)) {
          if (msgs?.[0]) {
            form.setError(key as FieldPath<ProfilePhoneFormValues>, { message: msgs[0] });
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
