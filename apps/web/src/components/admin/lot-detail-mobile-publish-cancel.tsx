"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  connectBlocked?: boolean;
  saleStatus?: string | null;
  canCancel: boolean;
};

/** Compact slot for CatalogMobileActionBar — publish/cancel need client mutations. */
export function LotDetailMobilePublishCancel({
  lotId,
  sellerLegalEntityId,
  canPublish,
  connectBlocked = false,
  saleStatus = null,
  canCancel,
}: Props) {
  const publishViaSale = saleStatus === "draft";
  const showLotPublish = canPublish && !publishViaSale;
  if (!showLotPublish && !canCancel && !(publishViaSale && canPublish)) return null;
  return (
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
          />
        ) : null}
        {canCancel ? <CancelLotButton lotId={lotId} /> : null}
      </div>
    </div>
  );
}
