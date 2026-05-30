"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import {
  DeleteLotDialog,
  useDeleteLotDialog,
} from "@/components/admin/lot-actions/delete-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import { buildLotLifecycleActionItems } from "@/lib/admin/build-lot-mobile-actions";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import { Button } from "@auction/ui/components/button";

type Props = {
  lotId: string;
  lotTitle: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  connectBlocked?: boolean;
  saleStatus?: string | null;
  publishReadiness?: CatalogReadinessResult | null;
  canCancel: boolean;
  canDelete: boolean;
};

/** Compact slot for CatalogMobileActionBar — publish/cancel/delete need client mutations. */
export function LotDetailMobilePublishCancel({
  lotId,
  lotTitle,
  sellerLegalEntityId,
  canPublish,
  connectBlocked = false,
  saleStatus = null,
  publishReadiness = null,
  canCancel,
  canDelete,
}: Props) {
  const publishViaSale = saleStatus === "draft";
  const showLotPublish = canPublish && !publishViaSale;
  const { open: deleteOpen, setOpen: setDeleteOpen } = useDeleteLotDialog();
  const lifecycleItems = buildLotLifecycleActionItems({
    canPublish: showLotPublish,
    canCancel,
    canDelete,
    publishViaSale,
  });

  if (
    !showLotPublish &&
    !canCancel &&
    !(publishViaSale && canPublish) &&
    lifecycleItems.length === 0
  ) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        {publishViaSale && canPublish ? (
          <p className="max-w-xs text-right font-body text-xs text-on-surface-variant">
            {draftSaleLotPublishBanner()}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-1">
          {showLotPublish ? (
            <PublishLotButton
              lotId={lotId}
              sellerLegalEntityId={sellerLegalEntityId}
              connectBlocked={connectBlocked}
              publishReadiness={publishReadiness}
            />
          ) : null}
          {canCancel ? <CancelLotButton lotId={lotId} /> : null}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => setDeleteOpen(true)}
            >
              Delete lot
            </Button>
          ) : null}
        </div>
      </div>
      {canDelete ? (
        <DeleteLotDialog
          lotId={lotId}
          lotTitle={lotTitle}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  );
}
