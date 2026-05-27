"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
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
  /** When true, seller Connect is not ready — publish is disabled. */
  connectBlocked?: boolean;
  /** When lot belongs to a draft sale, publish is done via sale publish. */
  saleStatus?: string | null;
  publishReadiness?: CatalogReadinessResult | null;
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
  connectBlocked = false,
  saleStatus = null,
  publishReadiness = null,
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

  const publishViaSale = saleStatus === "draft";
  const showLotPublish = canPublish && !publishViaSale;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {editLabel ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={editHref}>{editLabel}</Link>
        </Button>
      ) : null}
      {publishViaSale && canPublish ? (
        <p className="max-w-xs font-body text-xs text-on-surface-variant">
          {draftSaleLotPublishBanner()}
        </p>
      ) : null}
      {showLotPublish ? (
        <PublishLotButton
          lotId={lotId}
          sellerLegalEntityId={sellerLegalEntityId}
          connectBlocked={connectBlocked}
          publishReadiness={publishReadiness}
        />
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
