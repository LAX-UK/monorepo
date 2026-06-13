"use client";

import { RHFCheckboxField } from "@/components/auth/primitives/checkbox-field";
import { AUTH_INLINE_LINK } from "@/lib/auth/auth-link-classes";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { SITE_SHORT_NAME } from "@/lib/brand";
import Link from "next/link";
import type { Control } from "react-hook-form";

export function SignUpLegalConsent({ control }: { control: Control<SignUpFormValues> }) {
  return (
    <RHFCheckboxField control={control} name="acceptTerms">
      I agree to {SITE_SHORT_NAME}{" "}
      <Link href="/terms" className={AUTH_INLINE_LINK}>
        Conditions of Business
      </Link>
      . I confirm that I have read and understood the{" "}
      <Link href="/privacy" className={AUTH_INLINE_LINK}>
        Privacy Notice
      </Link>{" "}
      and I am 18 or over.
    </RHFCheckboxField>
  );
}
