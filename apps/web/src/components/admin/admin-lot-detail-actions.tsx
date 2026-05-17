"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import Link from "next/link";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  canCancel: boolean;
  showEditDraft: boolean;
  /** Draft + scheduled + active: open /edit for catalog (core form only for draft). */
  showEditCatalog: boolean;
};

export function AdminLotDetailActions({
  lotId,
  sellerLegalEntityId,
  canPublish,
  canCancel,
  showEditDraft,
  showEditCatalog,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {showEditDraft ? (
          <Link
            href={`/admin/lots/${lotId}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-low"
          >
            Edit draft
          </Link>
        ) : null}
        {showEditCatalog && !showEditDraft ? (
          <Link
            href={`/admin/lots/${lotId}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-low"
          >
            Edit catalog copy
          </Link>
        ) : null}
        <Link
          href={`/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`}
          className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-low"
        >
          Duplicate as new draft
        </Link>
        {canPublish ? (
          <PublishLotButton lotId={lotId} sellerLegalEntityId={sellerLegalEntityId} />
        ) : null}
        {canCancel ? <CancelLotButton lotId={lotId} /> : null}
      </div>
    </div>
  );
}
