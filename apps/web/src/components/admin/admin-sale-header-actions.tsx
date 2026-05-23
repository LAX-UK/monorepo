"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  SALE_PUBLISH_PHRASE,
  useSaleLifecycleActions,
} from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { salePath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  canEdit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canCancel: boolean;
  canMarkOnsiteEnded: boolean;
  /** Saleroom is available once a sale is published (scheduled onward). */
  showSaleroomLink?: boolean | undefined;
};

export function AdminSaleHeaderActions({
  saleId,
  saleTitle,
  canEdit,
  canPublish,
  canUnpublish,
  canCancel,
  canMarkOnsiteEnded,
  showSaleroomLink = false,
}: Props) {
  const { pending, publish, unpublish, markOnsiteEnded, cancel } = useSaleLifecycleActions(saleId);
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showSaleroomLink ? (
        <Button size="sm" asChild className="min-h-11">
          <Link href={`/admin/saleroom/${saleId}`}>Open saleroom</Link>
        </Button>
      ) : null}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/sales/${saleId}/edit`}>{canEdit ? "Edit draft" : "Edit details"}</Link>
      </Button>
      {canPublish ? (
        <>
          <Button type="button" size="sm" disabled={pending} onClick={() => setPublishOpen(true)}>
            Publish
          </Button>
          <TypedConfirmationDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            title="Publish this sale?"
            description={`Type ${SALE_PUBLISH_PHRASE} to schedule lots and make the sale visible to bidders.`}
            actionLabel="Publish sale"
            confirmationPhrase={SALE_PUBLISH_PHRASE}
            severity="warning"
            onConfirm={async () => {
              publish();
            }}
          />
        </>
      ) : null}
      {canUnpublish ? (
        <ConfirmActionButton
          size="sm"
          variant="secondary"
          disabled={pending}
          confirmTitle="Revert sale to draft?"
          confirmBody="All scheduled lots will also revert to draft."
          confirmLabel="Revert to draft"
          onConfirmed={unpublish}
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
          onConfirmed={markOnsiteEnded}
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
          onConfirmed={cancel}
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
