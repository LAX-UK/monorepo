"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default function AdminSofCaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-destructive/30 p-6">
      <h1 className="font-headline text-lg font-semibold text-on-surface">
        Could not load Source of Funds case
      </h1>
      <p className="text-sm text-on-surface-variant">{error.message}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Retry
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href="/admin/compliance/source-of-funds">Back to queue</Link>
        </Button>
      </div>
    </div>
  );
}
