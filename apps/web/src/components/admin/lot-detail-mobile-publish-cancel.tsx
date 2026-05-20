"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  canCancel: boolean;
};

/** Compact slot for CatalogMobileActionBar — publish/cancel need client mutations. */
export function LotDetailMobilePublishCancel({
  lotId,
  sellerLegalEntityId,
  canPublish,
  canCancel,
}: Props) {
  if (!canPublish && !canCancel) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {canPublish ? (
        <PublishLotButton lotId={lotId} sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
      {canCancel ? <CancelLotButton lotId={lotId} /> : null}
    </div>
  );
}
