"use client";

import { submitContactFormResult } from "@/app/(marketing)/contact/actions";
import { RhfSelect } from "@/components/ui/rhf-select";
import { contactFormValuesSchema } from "@/lib/contact/contact-input";
import { useActionForm } from "@/lib/forms/use-action-form";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

const topics = [
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
  { value: "shipping", label: "Shipping" },
  { value: "press", label: "Press" },
  { value: "other", label: "Other" },
] as const;

type ContactFormProps = {
  /**
   * Render the historical single `Name` field instead of the mockup's
   * split first/last fields. Both submit through the same wire schema.
   */
  nameMode?: "split" | "single";
};

export function ContactForm({ nameMode = "split" }: ContactFormProps = {}) {
  const [done, setDone] = useState(false);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: contactFormValuesSchema,
    defaultValues: {
      name: "",
      firstName: "",
      lastName: "",
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
        className="mt-6 block rounded-sm border border-divider-soft bg-surface px-6 py-8 text-center font-body text-sm text-on-surface"
        aria-live="polite"
      >
        Thank you — we&apos;ve received your message and will respond within two business days
        (GMT).
      </output>
    );
  }

  const fieldClass =
    "w-full rounded-sm border border-outline-variant bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const labelClass =
    "mb-1.5 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-brand-300";

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

        {nameMode === "split" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-first-name" className={labelClass}>
                    First name
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="contact-first-name"
                      maxLength={120}
                      className={fieldClass}
                      autoComplete="given-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-last-name" className={labelClass}>
                    Last name
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="contact-last-name"
                      maxLength={120}
                      className={fieldClass}
                      autoComplete="family-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="contact-name" className={labelClass}>
                  Name
                </FormLabel>
                <FormControl>
                  <Input
                    id="contact-name"
                    maxLength={120}
                    className={fieldClass}
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="contact-email" className={labelClass}>
                Email
              </FormLabel>
              <FormControl>
                <Input
                  id="contact-email"
                  type="email"
                  inputMode="email"
                  className={fieldClass}
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
              <FormLabel htmlFor="contact-topic" className={labelClass}>
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
              <FormLabel htmlFor="contact-message" className={labelClass}>
                Message
              </FormLabel>
              <FormControl>
                <Textarea id="contact-message" rows={5} className={fieldClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <ContactSubmitButton loading={isSubmitting}>Send message</ContactSubmitButton>
      </form>
    </Form>
  );
}

function ContactSubmitButton({
  loading,
  children,
  className,
  ...rest
}: { loading?: boolean; children: ReactNode } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
>) {
  return (
    <Button
      type="submit"
      disabled={loading || rest.disabled}
      className={cn(
        "rounded-sm bg-cta-bg px-7 py-3.5 font-label text-xs font-semibold uppercase tracking-[0.04em] text-cta-on shadow-none hover:bg-cta-bg/90",
        className,
      )}
      {...rest}
    >
      {loading ? "Sending\u2026" : children}
    </Button>
  );
}
