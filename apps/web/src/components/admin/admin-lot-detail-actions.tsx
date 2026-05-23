"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  lotId: string;
  publicHref: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  canCancel: boolean;
  showEditDraft: boolean;
  showEditLot: boolean;
  showEditCatalog: boolean;
};

export function AdminLotDetailActions({
  lotId,
  publicHref,
  sellerLegalEntityId,
  canPublish,
  canCancel,
  showEditDraft,
  showEditLot,
  showEditCatalog,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showEditDraft ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/lots/${lotId}/edit`}>Edit draft</Link>
        </Button>
      ) : null}
      {showEditLot ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/lots/${lotId}/edit`}>Edit lot</Link>
        </Button>
      ) : null}
      {showEditCatalog ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/lots/${lotId}/edit/catalog`}>Edit catalog copy</Link>
        </Button>
      ) : null}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`}>Duplicate draft</Link>
      </Button>
      {canPublish ? (
        <PublishLotButton lotId={lotId} sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
      {canCancel ? <CancelLotButton lotId={lotId} /> : null}
      <Button variant="ghost" size="sm" asChild>
        <Link href={publicHref} target="_blank" rel="noopener noreferrer">
          View on site
        </Link>
      </Button>
    </div>
  );
}
