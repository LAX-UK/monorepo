"use client";

import {
  SALE_PUBLISH_PHRASE,
  useSaleLifecycleActions,
} from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  type SaleLifecycleActionKind,
  buildSaleLifecycleActionItems,
  saleLifecycleConfirmCopy,
} from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { useCallback, useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  canPublish: boolean;
  publishReady?: boolean;
  canUnpublish: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canMarkOnsiteEnded: boolean;
};

/** Lifecycle publish/cancel actions for sale detail mobile bar trailing slot. */
export function SaleDetailMobileLifecycleTrailing({
  saleId,
  saleTitle,
  canPublish,
  publishReady = true,
  canUnpublish,
  canCancel,
  canDelete,
  canMarkOnsiteEnded,
}: Props) {
  const { pending, publish, unpublish, markOnsiteEnded, cancel, softDelete } =
    useSaleLifecycleActions(saleId);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<SaleLifecycleActionKind | null>(null);

  const lifecycleItems = buildSaleLifecycleActionItems({
    canPublish,
    canUnpublish,
    canMarkOnsiteEnded,
    canCancel,
    canDelete,
  });

  const runLifecycle = useCallback(
    (kind: SaleLifecycleActionKind) => {
      if (kind === "publish") publish();
      if (kind === "unpublish") unpublish();
      if (kind === "markEnded") markOnsiteEnded();
      if (kind === "cancel") cancel();
      if (kind === "delete") setDeleteOpen(true);
    },
    [cancel, markOnsiteEnded, publish, unpublish],
  );

  if (lifecycleItems.length === 0) return null;

  const confirmCopy = confirmKind ? saleLifecycleConfirmCopy(confirmKind) : null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        {lifecycleItems.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || (item.kind === "publish" && !publishReady)}
            title={
              item.kind === "publish" && !publishReady
                ? "Complete sale setup on the review step before publishing"
                : undefined
            }
            className="min-h-11"
            onClick={() => {
              if (item.kind === "publish" && !publishReady) return;
              if (item.kind === "publish") setPublishOpen(true);
              else if (item.kind === "delete") setDeleteOpen(true);
              else setConfirmKind(item.kind);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {canPublish ? (
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
      ) : null}
      {canDelete ? (
        <TypedConfirmationDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this sale?"
          description="The sale and all lots will be removed from the catalogue. Data is retained for audit."
          actionLabel="Delete sale"
          confirmationPhrase={saleDeleteConfirmationPhrase(saleTitle)}
          severity="danger"
          onConfirm={async () => {
            softDelete(saleDeleteConfirmationPhrase(saleTitle));
          }}
        />
      ) : null}
      {confirmCopy && confirmKind ? (
        <ConfirmDialog
          open={confirmKind != null}
          onOpenChange={(open) => {
            if (!open) setConfirmKind(null);
          }}
          title={confirmCopy.title}
          body={confirmCopy.description}
          confirmLabel={confirmCopy.actionLabel}
          onConfirm={() => {
            runLifecycle(confirmKind);
            setConfirmKind(null);
          }}
        />
      ) : null}
    </>
  );
}
