"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.service";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function FooterNewsletter() {
  const [status, setStatus] = useState<string | null>(null);
  const { run, loading, bannerError } = useNewsletterSubmit((value) =>
    defaultNewsletterSubmitter.submit(value),
  );
  const form = useForm<NewsletterSubscribeInput>({
    resolver: zodResolver(newsletterSubscribeSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run({ email: values.email });
    if (result.ok) {
      form.reset();
      setStatus(
        result.code === "already_subscribed" ? "You're already subscribed." : "You're on the list.",
      );
    }
  });

  return (
    <Form {...form}>
      <form
        className="w-full rounded-xl border border-outline-variant/20 bg-surface/70 p-5 shadow-sm sm:p-6"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="max-w-md space-y-2">
          <label
            htmlFor="footer-newsletter-email"
            className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
          >
            LAX Private List
          </label>
          <p className="font-footer-links text-sm leading-6 text-on-surface-variant">
            Auction previews, artist features and early access before the room opens.
          </p>
        </div>

        {status ? (
          <output
            className="mt-4 block rounded-sm border border-primary/20 bg-primary/10 px-3 py-2 font-footer-links text-xs font-medium text-primary"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </output>
        ) : null}

        {bannerError ? (
          <p
            className="mt-4 rounded-sm border border-error/30 bg-error-container/20 px-3 py-2 font-footer-links text-xs text-error"
            role="alert"
          >
            {bannerError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormControl>
                  <Input
                    id="footer-newsletter-email"
                    type="email"
                    autoComplete="email"
                    disabled={loading}
                    {...field}
                    placeholder="your@email.com"
                    className="min-h-12 rounded-md border-outline-variant bg-surface font-body text-base text-on-surface placeholder:text-on-surface-variant/60 md:text-sm"
                  />
                </FormControl>
                <FormMessage className="mt-2 text-xs text-error" />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="cta"
            className="min-h-12 shrink-0 rounded-md px-6 font-label text-xs uppercase tracking-[0.14em] sm:min-w-32"
            disabled={loading}
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </Button>
        </div>

        <p className="mt-4 max-w-md font-footer-links text-xs leading-5 text-on-surface-variant">
          Unsubscribe anytime. We respect your{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            privacy
          </Link>
          .
        </p>
      </form>
    </Form>
  );
}
