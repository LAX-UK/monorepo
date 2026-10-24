"use client";

import { AccountFrame } from "@/components/shell/account-frame";
import { Button } from "@auction/ui/components/button";

/** A client boundary cannot read the session or the product URLs, so it shows the bare shell. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AccountFrame viewer={null} nav={[]} products={[]} support={null}>
      <div className="flex w-full flex-col items-start gap-4 py-6" role="alert">
        <h1 className="font-headline text-3xl font-semibold tracking-tight sm:text-4xl">
          Something went wrong
        </h1>
        <p className="max-w-prose text-base leading-7 text-on-surface-variant">
          We couldn't load LAX Account just now. Please try again in a moment.
        </p>
        <Button type="button" variant="cta" size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="link" size="inline" className="min-h-11 self-start">
          <a href="/">Back to sign in</a>
        </Button>
      </div>
    </AccountFrame>
  );
}
