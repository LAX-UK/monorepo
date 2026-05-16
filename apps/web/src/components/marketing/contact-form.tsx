"use client";

import { submitContactFormResult } from "@/app/(marketing)/contact/actions";
import { UnderlineInput } from "@/components/ui/input";
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
  /** Render the historical single `Name` field instead of the mockup's
   * split first/last fields. Both submit through the same wire schema.
   */
  nameMode?: "split" | "single";
};

const underlineField =
  "font-body text-base placeholder:text-on-surface-variant/55 focus-visible:shadow-none";

const labelClass =
  "mb-1 block font-label text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant";

const messageField =
  "min-h-[8rem] w-full resize-y rounded-none border-0 border-b-2 border-outline/40 bg-transparent py-3 font-body text-sm text-on-surface shadow-none transition-colors placeholder:text-on-surface-variant/55 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0";

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

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="mt-6 max-w-[520px] space-y-6" noValidate>
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-first-name" className={labelClass}>
                    First name
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput
                      id="contact-first-name"
                      maxLength={120}
                      className={underlineField}
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
                    <UnderlineInput
                      id="contact-last-name"
                      maxLength={120}
                      className={underlineField}
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
                  <UnderlineInput
                    id="contact-name"
                    maxLength={120}
                    className={underlineField}
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
                <UnderlineInput
                  id="contact-email"
                  type="email"
                  inputMode="email"
                  className={underlineField}
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
                triggerClassName="min-h-11 w-full rounded-none border-0 border-b-2 border-outline/40 bg-transparent px-0 py-3 font-body text-sm text-on-surface shadow-none focus-visible:ring-0"
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
                <Textarea id="contact-message" rows={5} className={messageField} {...field} />
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
