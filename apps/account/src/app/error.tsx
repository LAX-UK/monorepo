"use client";

import { AccountFrame } from "@/components/shell/account-frame";
import { Button } from "@auction/ui/components/button";

/** A client boundary cannot read the session or the product URLs, so it shows the bare shell. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AccountFrame viewer={null} nav={[]} products={[]} support={null}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10" role="alert">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-on-surface-variant">
          We couldn't load LAX Account just now. Please try again in a moment.
        </p>
        <Button type="button" variant="cta" size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="link" size="inline" className="self-start">
          <a href="/">Back to sign in</a>
        </Button>
      </div>
    </AccountFrame>
  );
}
