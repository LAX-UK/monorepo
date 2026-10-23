"use client";

import { AccountShell } from "@/components/account-shell";
import { Button } from "@auction/ui/components/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AccountShell>
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
    </AccountShell>
  );
}
