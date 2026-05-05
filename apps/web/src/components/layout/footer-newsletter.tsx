"use client";

import { defaultNewsletterSubmitter } from "@/lib/newsletter/services/newsletter.service";
import { useNewsletterSubmit } from "@/lib/newsletter/use-newsletter-submit";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { useState } from "react";

export function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const { run, loading, bannerError } = useNewsletterSubmit((value) =>
    defaultNewsletterSubmitter.submit(value),
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          const result = await run({ email });
          if (result.ok) {
            setEmail("");
            setStatus(
              result.code === "already_subscribed"
                ? "You're already subscribed."
                : "You're on the list.",
            );
          }
        })();
      }}
    >
      <label
        htmlFor="footer-newsletter-email"
        className="font-label text-xs font-bold uppercase tracking-widest text-on-surface"
      >
        LAX Private List
      </label>
      <div className="flex flex-col gap-2">
        <Input
          id="footer-newsletter-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className="min-h-11 border-outline-variant bg-surface font-body text-sm"
        />
        <Button
          type="submit"
          variant="cta"
          className="min-h-11 font-label text-xs uppercase tracking-[0.08em]"
          disabled={loading}
        >
          {loading ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      <p className="font-footer-links text-xs text-on-surface-variant" aria-live="polite">
        {bannerError ?? status ?? "Auction previews and early access, no noise."}
      </p>
    </form>
  );
}
