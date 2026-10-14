"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ShopGlobalError({
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
    <html lang="en">
      <body>
        <main id="main-content" className="shop-page shop-page--error">
          <h1>Something went wrong</h1>
          <p>We could not load the shop. Try again or return home.</p>
          <button type="button" className="shop-detail__cta shop-focus-ring" onClick={reset}>
            Try again
          </button>
          <a href="/" className="shop-detail__cta shop-focus-ring">
            Return home
          </a>
        </main>
      </body>
    </html>
  );
}
