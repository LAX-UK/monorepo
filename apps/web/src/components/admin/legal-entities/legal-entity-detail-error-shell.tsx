"use client";

import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";

/** Error recovery inside legal entity detail shell. */
export function LegalEntityDetailErrorShell({
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
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref="/admin/legal-entities"
      backLabel="Legal entities"
      title="Legal entity"
      description="Could not load this entity."
    >
      <AdminListAlert title="Could not load legal entity">
        {adminRouteErrorMessage(error)}
      </AdminListAlert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" onClick={reset}>
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/legal-entities">Back to legal entities</Link>
        </Button>
      </div>
    </AdminEntityDetailShell>
  );
}
