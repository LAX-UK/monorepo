"use client";

import { Button } from "@/components/account-button";
import { AccountFrame } from "@/components/shell/account-frame";
import { EmptyState } from "@auction/ui/components/empty-state";

/** A client boundary cannot read the session or the product URLs, so it shows the bare shell. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AccountFrame viewer={null} nav={[]} products={[]} support={null}>
      <EmptyState
        role="alert"
        variant="plain"
        size="page"
        illustration="askew"
        headingLevel="h1"
        title="Something went wrong"
        description="We couldn't load LAX Account just now. Please try again in a moment."
        action={
          <>
            <Button type="button" variant="cta" size="lg" onClick={reset}>
              Try again
            </Button>
            <Button asChild variant="link" size="inline" className="min-h-11">
              <a href="/">Back to sign in</a>
            </Button>
          </>
        }
      />
    </AccountFrame>
  );
}
