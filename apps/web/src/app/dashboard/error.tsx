"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
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
      className="mx-auto flex min-h-[40vh] max-w-lg flex-col justify-center px-6 py-16 text-center"
    >
      <Alert variant="destructive" className="mb-8 text-left">
        <AlertTitle>Dashboard error</AlertTitle>
        <AlertDescription>
          {process.env.NODE_ENV === "development" ? error.message : "Please try again in a moment."}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap justify-center gap-4">
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 bg-transparent px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Dashboard home
        </Link>
      </div>
    </main>
  );
}
