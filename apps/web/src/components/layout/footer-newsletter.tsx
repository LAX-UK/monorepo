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
        className="rounded-sm border border-outline-variant/20 bg-surface/60 p-4 shadow-sm"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="space-y-1.5">
          <label
            htmlFor="footer-newsletter-email"
            className="font-label text-xs font-bold uppercase tracking-widest text-on-surface"
          >
            LAX Private List
          </label>
          <p className="font-footer-links text-xs leading-relaxed text-on-surface-variant">
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

        <div className="mt-4 flex flex-col sm:flex-row">
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
                    className="min-h-11 rounded-b-none rounded-t-sm border-outline-variant bg-surface font-body text-sm text-on-surface sm:rounded-l-sm sm:rounded-r-none sm:border-r-0"
                  />
                </FormControl>
                <FormMessage className="mt-2 text-xs text-error" />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="cta"
            className="min-h-11 rounded-b-sm rounded-t-none px-5 font-label text-xs uppercase tracking-[0.08em] sm:rounded-l-none sm:rounded-r-sm"
            disabled={loading}
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </Button>
        </div>

        <p className="mt-3 font-footer-links text-[0.7rem] leading-relaxed text-on-surface-variant">
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
