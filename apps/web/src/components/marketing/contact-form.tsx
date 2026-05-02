"use client";

import { submitContactFormResult } from "@/app/(marketing)/contact/actions";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { RhfSelect } from "@/components/ui/rhf-select";
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
import { Textarea } from "@auction/ui/components/textarea";
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
      <form onSubmit={onSubmit} className="mt-6 max-w-[520px] space-y-5" noValidate>
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
                <Input tabIndex={-1} autoComplete="off" className="hidden" {...field} />
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
                className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-brand-300"
              >
                Name
              </FormLabel>
              <FormControl>
                <Input
                  id="contact-name"
                  maxLength={120}
                  className="w-full rounded-sm border border-outline-variant bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-brand-300"
              >
                Email
              </FormLabel>
              <FormControl>
                <Input
                  id="contact-email"
                  type="email"
                  inputMode="email"
                  className="w-full rounded-sm border border-outline-variant bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-brand-300"
              >
                Topic
              </FormLabel>
              <RhfSelect
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                options={topics.map((t) => ({ value: t.value, label: t.label }))}
                triggerClassName="min-h-11 w-full rounded-sm border border-outline-variant bg-surface px-4 py-3 font-body text-sm"
              />
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
                className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-brand-300"
              >
                Message
              </FormLabel>
              <FormControl>
                <Textarea
                  id="contact-message"
                  rows={6}
                  className="w-full rounded-sm border border-outline-variant bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AuthSubmitButton
          loading={isSubmitting}
          loadingLabel="Sending…"
          className="w-full sm:w-auto"
        >
          Send message
        </AuthSubmitButton>
      </form>
    </Form>
  );
}
