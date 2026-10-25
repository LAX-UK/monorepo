"use client";

import { Button } from "@auction/ui/components/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Replaces the root layout when it fails, so it cannot rely on the app's fonts or styles. */
export default function ArtGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1.5rem" }}>
        <main id="main-content" style={{ maxWidth: "36rem", margin: "0 auto" }}>
          <h1>Something went wrong</h1>
          <p>We could not load lax.art. Try again or return home.</p>
          <p style={{ display: "flex", gap: "1rem" }}>
            <Button type="button" variant="default" onClick={reset}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <a href="/">Return home</a>
            </Button>
          </p>
        </main>
      </body>
    </html>
  );
}
