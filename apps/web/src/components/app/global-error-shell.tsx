"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type GlobalErrorShellProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Branded fallback when the root layout fails (no app chrome). */
export function GlobalErrorShell({ error, reset }: GlobalErrorShellProps) {
  const message = process.env.NODE_ENV === "development" ? error.message : "Please try again.";

  return (
    <html lang="en">
      <body className="min-h-screen bg-surface px-6 py-24 font-sans text-on-surface">
        <main
          id="main-content"
          className="mx-auto flex max-w-lg flex-col items-center text-center"
          role="alert"
        >
          <p className="mb-4 font-label text-xs font-bold uppercase tracking-[0.4em] text-primary">
            Error
          </p>
          <h1 className="mb-4 font-headline text-3xl tracking-tight">Something went wrong</h1>
          <p className="mb-8 font-body text-sm text-on-surface-variant">{message}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="default" onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to gallery</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
