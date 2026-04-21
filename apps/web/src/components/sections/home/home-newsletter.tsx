"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.service";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { FloatingLabelInput } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function HomeNewsletter() {
  const [done, setDone] = useState(false);
  const { run, loading, bannerError } = useNewsletterSubmit((email) =>
    defaultNewsletterSubmitter.submit(email),
  );

  const form = useForm<NewsletterSubscribeInput>({
    resolver: zodResolver(newsletterSubscribeSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run({ email: values.email });
    if (result.ok) {
      form.reset();
      setDone(true);
    }
  });

  return (
    <section className="mx-auto max-w-[var(--container-max,1440px)] px-8 py-24 text-center md:py-32 md:px-8">
      <h2 className="mb-10 font-headline text-4xl font-light italic text-on-surface md:text-5xl">
        The Curator&apos;s Letter
      </h2>
      <p className="mx-auto mb-16 max-w-3xl text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
        Join our private circle for exclusive access to viewing rooms, early lot registration, and
        distinguished market analysis delivered with care.
      </p>

      {done ? (
        <output
          className="mx-auto block max-w-xl px-4 text-center font-body text-sm text-primary"
          aria-live="polite"
          aria-atomic="true"
        >
          Thank you — you&apos;re on the list. We&apos;ll be in touch shortly.
        </output>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="mx-auto max-w-xl text-left" noValidate>
            {bannerError ? (
              <Alert variant="destructive" className="mb-4" aria-live="assertive">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-4">
              <div className="min-w-0 flex-1">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FloatingLabelInput
                          {...field}
                          label="Email for invitation"
                          type="email"
                          autoComplete="email"
                          disabled={loading}
                        />
                      </FormControl>
                      <FormMessage className="mt-4 text-sm text-error" />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="submit"
                variant="cta"
                disabled={loading}
                className="h-[52px] shrink-0 px-8 sm:h-[60px]"
              >
                {loading ? "Subscribing…" : "Subscribe"}
              </Button>
            </div>
            <p className="mt-4 text-center font-footer-links text-xs leading-relaxed text-on-surface-variant">
              By subscribing you agree to our{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary underline underline-offset-2 hover:opacity-90"
              >
                Privacy Policy
              </Link>
              . We only use your email for auction-related updates.
            </p>
          </form>
        </Form>
      )}
    </section>
  );
}
