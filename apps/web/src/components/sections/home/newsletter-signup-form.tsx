"use client";

import { publicFormResolver } from "@/lib/forms/public-form-resolver";
import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.client";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { cn } from "@auction/ui";
import { Button, Field, Notice, TextInput } from "@auction/ui/lax";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  /** `onDark` for use on the near-black home hero. */
  tone?: "default" | "onDark";
};

/** Email sign-up for the newsletter, shared by the home hero and the home footer band. */
export function NewsletterSignupForm({ tone = "default" }: Props) {
  const onDark = tone === "onDark";
  const [status, setStatus] = useState<"subscribed" | "already_subscribed" | null>(null);
  const { run, loading, bannerError } = useNewsletterSubmit((email) =>
    defaultNewsletterSubmitter.submit(email),
  );

  const form = useForm<NewsletterSubscribeInput>({
    resolver: publicFormResolver(newsletterSubscribeSchema),
    defaultValues: { email: "" },
    reValidateMode: "onBlur",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run({ email: values.email });
    if (result.ok) {
      form.reset();
      setStatus(
        result.newsletterDisposition === "already_subscribed" ? "already_subscribed" : "subscribed",
      );
    }
  });

  if (status) {
    return (
      <Notice
        tone="success"
        title={status === "already_subscribed" ? "You're already subscribed" : "You're on the list"}
        className="mx-auto w-full max-w-[420px] text-left"
      >
        {status === "already_subscribed" ? "See you in your inbox." : "We'll be in touch."}
      </Notice>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-[420px] flex-col gap-3 text-left"
      noValidate
    >
      {bannerError ? <Notice tone="danger" alert title={bannerError} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Field
          label="Email address"
          labelHidden
          id="newsletter-email"
          error={form.formState.errors.email?.message}
          // The hero ground is near-black in both themes, so its message is white on it.
          className={cn("flex-1", onDark && "[&>p:last-child]:text-white")}
        >
          <TextInput
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            disabled={loading}
            {...form.register("email")}
          />
        </Field>
        <Button
          type="submit"
          variant={onDark ? "secondary" : "primary"}
          loading={loading}
          // The hero ground is near-black in both themes, so its button is a fixed light fill with dark text in both
          // (theme-aware cream tokens turn dark in dark mode).
          className={cn(
            "shrink-0",
            onDark &&
              "border-transparent bg-white text-brand-900 hover:bg-brand-100 active:bg-brand-100",
          )}
        >
          {loading ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
    </form>
  );
}
