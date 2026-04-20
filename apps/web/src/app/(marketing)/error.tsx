"use client";

import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import Link from "next/link";
import { useEffect } from "react";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-6 py-24 text-center"
    >
      <DisplayHeading as="h1" className="mb-4 text-3xl">
        Gallery unavailable
      </DisplayHeading>
      <p className="mb-8 font-body text-sm text-on-surface-variant">
        {process.env.NODE_ENV === "development" ? error.message : "Please try again in a moment."}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Back to gallery
        </Link>
      </div>
    </main>
  );
}
