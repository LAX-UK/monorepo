"use client";

import { AdminDetailSkeleton } from "@/components/admin/admin-detail-skeleton";
import { Button } from "@auction/ui/components/button";
import { useEffect } from "react";

export default function AdminLegalEntityDetailError({
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
    <div className="space-y-6">
      <AdminDetailSkeleton />
      <div className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
        <h2 className="font-headline text-lg text-on-surface">Could not load legal entity</h2>
        <p className="mt-2 font-body text-sm text-on-surface-variant">
          {error.message || "Something went wrong loading this entity."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="default" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" asChild>
            <a href="/admin/legal-entities">Back to lookup</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
