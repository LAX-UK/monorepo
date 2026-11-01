"use client";

import { submitContactFormResult } from "@/app/(marketing)/contact/actions";
import { SITE_CONTACT_EMAIL } from "@/lib/brand";
import { contactFormValuesSchema } from "@/lib/contact/contact-input";
import { publicFormErrorMap, submitFailureCopy } from "@/lib/forms/error-copy";
import { useActionForm } from "@/lib/forms/use-action-form";
import { useFormErrorSummary } from "@/lib/forms/use-form-error-summary";
import { contactIntentFromSearchParams } from "@/lib/marketing/contact-intent-copy";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import {
  Button,
  ButtonLink,
  ErrorSummary,
  Field,
  NativeSelect,
  Notice,
  TextArea,
  TextInput,
} from "@auction/ui/lax";
import Link from "next/link";
import { useState } from "react";
import { Controller } from "react-hook-form";

const topics = [
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
  { value: "shipping", label: "Shipping" },
  { value: "press", label: "Press" },
  { value: "other", label: "Other" },
] as const;

type ContactFormProps = {
  /** Render the historical single `Name` field instead of the mockup's
   * split first/last fields. Both submit through the same wire schema.
   */
  nameMode?: "split" | "single";
  intent?: string | null;
  sellType?: string | null;
};

/** The control ids the error summary links to, in page order. */
const FIELD_IDS = {
  split: {
    firstName: "contact-first-name",
    lastName: "contact-last-name",
    email: "contact-email",
    topic: "contact-topic",
    message: "contact-message",
  },
  single: {
    firstName: "contact-name",
    email: "contact-email",
    topic: "contact-topic",
    message: "contact-message",
  },
} as const;

export function ContactForm({
  nameMode = "split",
  intent = null,
  sellType = null,
}: ContactFormProps = {}) {
  const intentConfig = contactIntentFromSearchParams({ intent, type: sellType });
  const [done, setDone] = useState(false);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: contactFormValuesSchema,
    defaultValues: {
      name: "",
      firstName: "",
      lastName: "",
      email: "",
      topic: intentConfig.topic,
      message: "",
      website: "",
    },
    action: submitContactFormResult,
    onSuccess: () => setDone(true),
    errorMap: publicFormErrorMap,
    // The summary takes focus after a failed submit, and a failed send shows in the form's notice.
    formOptions: { reValidateMode: "onBlur", shouldFocusError: false },
    focusInvalidField: false,
    toastFailure: false,
  });
  const summary = useFormErrorSummary(form, FIELD_IDS[nameMode]);
  const errors = form.formState.errors;

  if (done) {
    const ctaLabel = intentConfig.successCtaLabel;
    const ctaHref = intentConfig.successCtaHref ?? (ctaLabel ? sellIntakeHref() : null);
    return (
      <Notice
        tone="success"
        title="Message sent"
        className="mt-6 max-w-[520px]"
        {...(ctaLabel && ctaHref
          ? {
              actions: (
                <ButtonLink Link={Link} href={ctaHref} variant="secondary">
                  {ctaLabel}
                </ButtonLink>
              ),
            }
          : {})}
      >
        {intentConfig.successMessage}
      </Notice>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex max-w-[520px] flex-col gap-5" noValidate>
      {intentConfig.headline ? (
        <p className="text-lax-ui text-lax-muted">{intentConfig.headline}</p>
      ) : null}
      <ErrorSummary errors={summary.errors} focusKey={summary.focusKey} />
      {rootError ? (
        <Notice tone="danger" alert title={submitFailureCopy.title}>
          {submitFailureCopy.detail(SITE_CONTACT_EMAIL)}
        </Notice>
      ) : null}

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
        {...form.register("website")}
      />

      {nameMode === "split" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="First name"
            id={FIELD_IDS.split.firstName}
            error={errors.firstName?.message}
          >
            <TextInput maxLength={120} autoComplete="given-name" {...form.register("firstName")} />
          </Field>
          <Field label="Last name" id={FIELD_IDS.split.lastName} error={errors.lastName?.message}>
            <TextInput maxLength={120} autoComplete="family-name" {...form.register("lastName")} />
          </Field>
        </div>
      ) : (
        <Field
          label="Name"
          id={FIELD_IDS.single.firstName}
          error={errors.name?.message ?? errors.firstName?.message}
        >
          <TextInput maxLength={120} autoComplete="name" {...form.register("name")} />
        </Field>
      )}

      <Field label="Email" id="contact-email" error={errors.email?.message}>
        <TextInput
          type="email"
          inputMode="email"
          autoComplete="email"
          {...form.register("email")}
        />
      </Field>

      <Field label="Topic" id="contact-topic" error={errors.topic?.message}>
        <Controller
          control={form.control}
          name="topic"
          render={({ field }) => (
            <NativeSelect
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={topics}
            />
          )}
        />
      </Field>

      <Field label="Message" id="contact-message" error={errors.message?.message}>
        <TextArea rows={5} {...form.register("message")} />
      </Field>

      <div>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
