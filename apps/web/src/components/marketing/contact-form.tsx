"use client";

import { submitContactFormResult } from "@/app/(marketing)/contact/actions";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { contactFormValuesSchema } from "@/lib/contact/contact-input";
import { useActionForm } from "@/lib/forms/use-action-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { useState } from "react";

const topics = [
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
  { value: "shipping", label: "Shipping" },
  { value: "press", label: "Press" },
  { value: "other", label: "Other" },
] as const;

export function ContactForm() {
  const [done, setDone] = useState(false);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: contactFormValuesSchema,
    defaultValues: {
      name: "",
      email: "",
      topic: "buying",
      message: "",
      website: "",
    },
    action: submitContactFormResult,
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <output
        className="block rounded-lg border border-primary/30 bg-primary-container/10 px-6 py-8 font-body text-sm text-on-surface"
        aria-live="polite"
      >
        Thank you — we&apos;ve received your message and will respond within two business days
        (GMT).
      </output>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {rootError ? (
          <p
            className="rounded-sm border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error"
            role="alert"
          >
            {rootError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem className="hidden" aria-hidden>
              <FormControl>
                <Input
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                htmlFor="contact-name"
                className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
              >
                Name
              </FormLabel>
              <FormControl>
                <Input
                  id="contact-name"
                  maxLength={120}
                  className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                htmlFor="contact-email"
                className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
              >
                Email
              </FormLabel>
              <FormControl>
                <Input
                  id="contact-email"
                  type="email"
                  inputMode="email"
                  className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                htmlFor="contact-topic"
                className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
              >
                Topic
              </FormLabel>
              <FormControl>
                <select
                  id="contact-topic"
                  className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  {...field}
                >
                  {topics.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                htmlFor="contact-message"
                className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
              >
                Message
              </FormLabel>
              <FormControl>
                <textarea
                  id="contact-message"
                  rows={6}
                  className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AuthSubmitButton loading={isSubmitting} loadingLabel="Sending…" className="w-full sm:w-auto">
          Send message
        </AuthSubmitButton>
      </form>
    </Form>
  );
}
