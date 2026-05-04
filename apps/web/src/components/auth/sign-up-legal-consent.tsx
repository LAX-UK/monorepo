"use client";

import { RHFCheckboxField } from "@/components/auth/primitives/checkbox-field";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { SITE_SHORT_NAME } from "@/lib/brand";
import Link from "next/link";
import type { Control } from "react-hook-form";

export function SignUpLegalConsent({ control }: { control: Control<SignUpFormValues> }) {
  return (
    <RHFCheckboxField control={control} name="acceptTerms">
      I agree to {SITE_SHORT_NAME}{" "}
      <Link
        href="/terms"
        className="font-medium text-brand-900 underline underline-offset-2 dark:text-primary"
      >
        Conditions of Business
      </Link>
      . I confirm that I have read and understood the{" "}
      <Link
        href="/privacy"
        className="font-medium text-brand-900 underline underline-offset-2 dark:text-primary"
      >
        Privacy Notice
      </Link>{" "}
      and I am 18 or over.
    </RHFCheckboxField>
  );
}
