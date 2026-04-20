"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.service";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
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
    <section className="mx-auto max-w-5xl px-6 py-32 text-center md:px-20">
      <h2 className="mb-10 font-headline text-4xl font-light italic md:text-5xl">
        The Curator&apos;s Letter
      </h2>
      <p className="mx-auto mb-16 max-w-3xl text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
        Join our private circle for exclusive access to viewing rooms, early lot registration, and
        distinguished market analysis delivered with care.
      </p>

      {done ? (
        <Alert className="mx-auto max-w-xl border-0 bg-transparent text-center">
          <AlertDescription className="font-body text-sm text-primary">
            Thank you — you&apos;re on the list. We&apos;ll be in touch shortly.
          </AlertDescription>
        </Alert>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="relative mx-auto max-w-xl text-left" noValidate>
            {bannerError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="relative">
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
                        placeholder="EMAIL FOR INVITATION"
                        disabled={loading}
                        className="w-full border-0 border-b border-outline-variant/50 bg-transparent px-0 py-6 font-label text-xs font-bold uppercase tracking-[0.4em] text-on-surface placeholder:text-on-surface-variant focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
                        aria-label="Email for invitation"
                      />
                    </FormControl>
                    <FormMessage className="mt-4 text-sm text-error" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="ghost"
                disabled={loading}
                className="absolute right-0 top-1/2 -translate-y-1/2 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary transition-all duration-500 hover:bg-transparent hover:tracking-[0.5em] disabled:opacity-50"
              >
                {loading ? "Subscribing…" : "Subscribe"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </section>
  );
}
