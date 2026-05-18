"use client";

import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
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
    <section className="mx-auto flex w-full max-w-xl flex-col justify-center px-6 py-24 text-center">
      <DisplayHeading as="h1" className="mb-4 text-3xl">
        Admin hiccup
      </DisplayHeading>
      <p className="mb-8 font-body text-sm text-on-surface-variant">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "An admin operation failed unexpectedly. Try again or head to the cockpit."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Operations
        </Link>
      </div>
    </section>
  );
}
