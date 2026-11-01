"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.client";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
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
    resolver: zodResolver(newsletterSubscribeSchema),
    defaultValues: { email: "" },
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
      <output
        className={cn(
          "block text-center font-body text-base font-medium",
          onDark ? "text-white" : "text-primary",
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "already_subscribed"
          ? "You're already subscribed — see you in your inbox."
          : "You're on the list."}
      </output>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-[420px] text-left" noValidate>
        {bannerError ? (
          <Alert variant="destructive" className="mb-4" aria-live="assertive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col sm:flex-row">
          <div className="min-w-0 flex-1">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="your@email.com"
                      aria-label="Email address"
                      disabled={loading}
                      className="h-12 rounded-b-none rounded-t-sm border-outline-variant bg-surface px-4 font-body text-sm text-on-surface sm:rounded-l-sm sm:rounded-r-none sm:border-r-0"
                    />
                  </FormControl>
                  <FormMessage
                    className={cn("mt-3 text-sm", onDark ? "text-white" : "text-error")}
                  />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="submit"
            variant="cta"
            disabled={loading}
            className={cn(
              "h-12 rounded-b-sm rounded-t-none px-6 font-label text-xs sm:rounded-l-none sm:rounded-r-sm",
              onDark && "bg-brand-light-cream text-brand-900 hover:bg-brand-100",
            )}
          >
            {loading ? "Subscribing…" : "Subscribe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
