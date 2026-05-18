"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
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
        <ConfirmActionButton
          size="sm"
          variant="secondary"
          disabled={pending}
          confirmTitle="Revert sale to draft?"
          confirmBody="All scheduled lots will also revert to draft."
          confirmLabel="Revert to draft"
          onConfirmed={() => run(() => adminUnpublishSaleResultAction(saleId))}
        >
          Revert to draft
        </ConfirmActionButton>
      ) : null}
      {canMarkOnsiteEnded ? (
        <ConfirmActionButton
          size="sm"
          variant="secondary"
          disabled={pending}
          tone="warning"
          confirmTitle="End onsite sale?"
          confirmBody="This will end the sale and all remaining lots."
          confirmLabel="Mark ended"
          onConfirmed={() => run(() => adminMarkSaleEndedResultAction(saleId))}
        >
          Mark onsite sale ended
        </ConfirmActionButton>
      ) : null}
      {canCancel ? (
        <ConfirmActionButton
          size="sm"
          variant="secondary"
          disabled={pending}
          confirmTitle="Cancel entire sale?"
          confirmBody="This cancels the sale and remaining lots."
          confirmLabel="Cancel sale"
          onConfirmed={() => run(() => adminCancelSaleResultAction(saleId))}
        >
          Cancel sale
        </ConfirmActionButton>
      ) : null}
      <Button variant="ghost" size="sm" asChild>
        <Link href={salePath({ id: saleId, title: saleTitle })} target="_blank" rel="noreferrer">
          View on site
        </Link>
      </Button>
    </div>
  );
}
