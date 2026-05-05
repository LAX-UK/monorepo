"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.service";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function HomeNewsletter() {
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
      setStatus(result.code === "already_subscribed" ? "already_subscribed" : "subscribed");
    }
  });

  return (
    <section className="border-t border-outline-variant bg-surface-container-low px-6 py-20 text-center dark:bg-surface-container-lowest md:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-7">
        <div>
          <p className="mb-3 font-artists-serif text-xs font-light uppercase tracking-[0.18em] text-primary">
            LAX Private List
          </p>
          <h2 className="font-headline text-[34px] font-semibold leading-tight text-on-surface">
            Stay in the room.
          </h2>
          <p className="mt-3 font-body text-sm leading-7 text-on-surface-variant">
            Auction previews, artist features and early access — delivered before the gavel falls.
          </p>
        </div>

        {status ? (
          <output
            className="block text-center font-body text-base font-medium text-primary"
            aria-live="polite"
            aria-atomic="true"
          >
            {status === "already_subscribed"
              ? "You're already subscribed — see you in your inbox."
              : "You're on the list."}
          </output>
        ) : (
          <Form {...form}>
            <form onSubmit={onSubmit} className="w-full max-w-[420px] text-left" noValidate>
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
                            disabled={loading}
                            className="h-12 rounded-b-none rounded-t-sm border-outline-variant bg-surface px-4 font-body text-sm text-on-surface sm:rounded-l-sm sm:rounded-r-none sm:border-r-0"
                          />
                        </FormControl>
                        <FormMessage className="mt-3 text-sm text-error" />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  variant="cta"
                  disabled={loading}
                  className="h-12 rounded-b-sm rounded-t-none px-6 font-label text-xs uppercase tracking-[0.08em] sm:rounded-l-none sm:rounded-r-sm"
                >
                  {loading ? "Subscribing…" : "Subscribe"}
                </Button>
              </div>
            </form>
          </Form>
        )}
        <p className="font-footer-links text-xs leading-relaxed text-on-surface-variant">
          Unsubscribe any time. We respect your{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            privacy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
