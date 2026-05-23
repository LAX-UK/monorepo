"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { ExternalLink, MoreHorizontal } from "lucide-react";
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
  const editHref = showEditCatalog
    ? `/admin/lots/${lotId}/edit/catalog`
    : `/admin/lots/${lotId}/edit`;
  const editLabel = showEditDraft
    ? "Edit draft"
    : showEditLot
      ? "Edit lot"
      : showEditCatalog
        ? "Edit catalog copy"
        : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {editLabel ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={editHref}>{editLabel}</Link>
        </Button>
      ) : null}
      {canPublish ? (
        <PublishLotButton lotId={lotId} sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
      {canCancel ? <CancelLotButton lotId={lotId} /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="More lot actions">
            <MoreHorizontal className="size-4" aria-hidden />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`}>
              Duplicate draft
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={publicHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4 opacity-70" aria-hidden />
              View on site
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
