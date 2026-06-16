"use client";

import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import {
  type SofListStatus,
  buildSofListHref,
  parseSofDetailListStatus,
} from "@/lib/admin/sof-list-query";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function SofCaseDetailErrorShell({
  error,
  reset,
  listStatus: listStatusProp,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  listStatus?: SofListStatus;
}) {
  const searchParams = useSearchParams();
  const listStatus = listStatusProp ?? parseSofDetailListStatus(searchParams);
  const backHref = buildSofListHref(listStatus);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref={backHref}
      backLabel="Source of Funds"
      eyebrow="Compliance review"
      title="Source of Funds case"
      description="Could not load this case."
    >
      <AdminListAlert title="Could not load Source of Funds case">
        {adminRouteErrorMessage(error)}
      </AdminListAlert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" onClick={reset}>
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href={backHref}>Back to queue</Link>
        </Button>
      </div>
    </AdminEntityDetailShell>
  );
}
