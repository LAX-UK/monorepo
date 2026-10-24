"use client";

import { CancelLotButton } from "@/components/admin/lot-actions/cancel-lot-button";
import {
  DeleteLotDialog,
  type DeleteLotParentSale,
  useDeleteLotDialog,
} from "@/components/admin/lot-actions/delete-lot-button";
import { PublishLotButton } from "@/components/admin/lot-actions/publish-lot-button";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import { OverflowMenu, StaffButton, type StaffLinkComponent } from "@auction/staff-ui";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NextLink: StaffLinkComponent = Link;

type Props = {
  lotId: string;
  lotTitle: string;
  publicHref: string;
  sellerLegalEntityId: string | null;
  canPublish: boolean;
  /** When true, seller Connect is not ready — publish is disabled. */
  connectBlocked?: boolean;
  /** When lot belongs to a draft sale, publish is done via sale publish. */
  saleStatus?: string | null;
  publishReadiness?: CatalogReadinessResult | null;
  canCancel: boolean;
  canDelete: boolean;
  parentSale?: DeleteLotParentSale | null;
  showEditDraft: boolean;
  showEditLot: boolean;
  showEditCatalog: boolean;
};

/**
 * The lot page's actions: the one that moves the lot forward (publish, or edit) is the primary
 * button; cancelling the auction is a red secondary; the rest sit in the overflow menu, with
 * delete last. Each appears only for roles the API lets do it.
 */
export function AdminLotDetailActions({
  lotId,
  lotTitle,
  publicHref,
  sellerLegalEntityId,
  canPublish,
  connectBlocked = false,
  saleStatus = null,
  publishReadiness = null,
  canCancel,
  canDelete,
  parentSale = null,
  showEditDraft,
  showEditLot,
  showEditCatalog,
}: Props) {
  const router = useRouter();
  const { open: deleteOpen, setOpen: setDeleteOpen } = useDeleteLotDialog();
  const editHref = showEditCatalog
    ? `/admin/lots/${lotId}/edit/catalog`
    : `/admin/lots/${lotId}/edit`;
  const editLabel = showEditDraft
    ? "Edit draft"
    : showEditLot
      ? "Edit lot"
      : showEditCatalog
        ? "Edit catalogue copy"
        : null;

  const publishViaSale = saleStatus === "draft";
  const showLotPublish = canPublish && !publishViaSale;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {publishViaSale && canPublish ? (
        <p className="max-w-xs text-staff-xs text-staff-muted">{draftSaleLotPublishBanner()}</p>
      ) : null}
      <OverflowMenu
        label="More lot actions"
        Link={NextLink}
        actions={[
          {
            id: "view",
            label: "View on site",
            icon: ExternalLink,
            onSelect: () => window.open(publicHref, "_blank", "noopener"),
          },
          {
            id: "duplicate",
            label: "Duplicate as draft",
            icon: Copy,
            onSelect: () => router.push(`/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`),
          },
          ...(canDelete
            ? [
                {
                  id: "delete",
                  label: "Delete lot…",
                  icon: Trash2,
                  tone: "danger" as const,
                  onSelect: () => setDeleteOpen(true),
                },
              ]
            : []),
        ]}
      />
      {canCancel ? <CancelLotButton lotId={lotId} /> : null}
      {editLabel ? (
        <StaffButton
          asChild
          variant={showLotPublish ? "secondary" : "primary"}
          icon={<Pencil aria-hidden />}
        >
          <Link href={editHref}>{editLabel}</Link>
        </StaffButton>
      ) : null}
      {showLotPublish ? (
        <PublishLotButton
          lotId={lotId}
          sellerLegalEntityId={sellerLegalEntityId}
          connectBlocked={connectBlocked}
          publishReadiness={publishReadiness}
        />
      ) : null}
      {canDelete ? (
        <DeleteLotDialog
          lotId={lotId}
          lotTitle={lotTitle}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          parentSale={parentSale}
        />
      ) : null}
    </div>
  );
}
