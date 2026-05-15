"use client";

import {
  adminCancelSaleResultAction,
  adminMarkSaleEndedResultAction,
  adminPublishSaleResultAction,
  adminUnpublishSaleResultAction,
} from "@/lib/actions/admin-sales";
import type { ActionResult } from "@/lib/forms/form-result";
import { salePath } from "@/lib/seo/url";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  canEdit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canCancel: boolean;
  canMarkOnsiteEnded: boolean;
};

export function AdminSaleHeaderActions({
  saleId,
  saleTitle,
  canEdit,
  canPublish,
  canUnpublish,
  canCancel,
  canMarkOnsiteEnded,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          notify.success("Done");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/sales/${saleId}/edit`}>{canEdit ? "Edit draft" : "Edit details"}</Link>
      </Button>
      {canPublish ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run(() => adminPublishSaleResultAction(saleId))}
        >
          Publish
        </Button>
      ) : null}
      {canUnpublish ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (
              !confirm("Revert this sale to draft? All scheduled lots will also revert to draft.")
            )
              return;
            run(() => adminUnpublishSaleResultAction(saleId));
          }}
        >
          Revert to draft
        </Button>
      ) : null}
      {canMarkOnsiteEnded ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm("End this onsite sale and all of its remaining lots?")) return;
            run(() => adminMarkSaleEndedResultAction(saleId));
          }}
        >
          Mark onsite sale ended
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm("Cancel the entire sale and remaining lots?")) return;
            run(() => adminCancelSaleResultAction(saleId));
          }}
        >
          Cancel sale
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" asChild>
        <Link href={salePath({ id: saleId, title: saleTitle })} target="_blank" rel="noreferrer">
          View on site
        </Link>
      </Button>
    </div>
  );
}
