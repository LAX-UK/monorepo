"use client";

import { Button } from "@auction/ui/components/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-container-lowest px-6 py-24 font-sans text-on-surface">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {process.env.NODE_ENV === "development" ? error.message : "Please try again."}
        </p>
        <Button
          type="button"
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-on-primary"
          onClick={() => reset()}
        >
          Try again
        </Button>
      </body>
    </html>
  );
}
