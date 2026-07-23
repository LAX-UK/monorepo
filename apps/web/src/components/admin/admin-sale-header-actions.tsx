"use client";

import {
  SALE_PUBLISH_PHRASE,
  useSaleLifecycleActions,
} from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { saleLifecycleConfirmCopy } from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import {
  adminSaleEditHref,
  adminSaleSetupHref,
  adminSaleroomHref,
} from "@/lib/admin/catalog-route-helpers";
import { salePath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type ConfirmKind = "unpublish" | "markEnded" | "cancel";

type Props = {
  saleId: string;
  saleTitle: string;
  canEdit: boolean;
  canPublish: boolean;
  /** When false, publish is disabled until setup checklist passes. */
  publishReady?: boolean;
  canUnpublish: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canMarkOnsiteEnded: boolean;
  showSaleroomLink?: boolean | undefined;
  /** When true, saleroom CTA is rendered by the parent shell instead. */
  hideSaleroomLink?: boolean | undefined;
};

export function AdminSaleHeaderActions({
  saleId,
  saleTitle,
  canEdit,
  canPublish,
  publishReady = true,
  canUnpublish,
  canCancel,
  canDelete,
  canMarkOnsiteEnded,
  showSaleroomLink = false,
  hideSaleroomLink = false,
}: Props) {
  const { pending, publish, unpublish, markOnsiteEnded, cancel, softDelete } =
    useSaleLifecycleActions(saleId);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);

  const hasMoreActions = canPublish || canUnpublish || canMarkOnsiteEnded || canCancel || canDelete;
  const copy = confirmKind ? saleLifecycleConfirmCopy(confirmKind) : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showSaleroomLink && !hideSaleroomLink ? (
        <Button size="sm" asChild>
          <Link href={adminSaleroomHref(saleId)}>Open saleroom</Link>
        </Button>
      ) : null}
      {canEdit ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={adminSaleEditHref(saleId)}>Edit draft</Link>
        </Button>
      ) : null}
      {hasMoreActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" aria-label="More sale actions">
              <MoreHorizontal className="size-4" aria-hidden />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {canPublish ? (
              <DropdownMenuItem
                disabled={pending || !publishReady}
                title={
                  !publishReady
                    ? "Complete sale setup on the review step before publishing"
                    : undefined
                }
                onSelect={(e) => {
                  e.preventDefault();
                  if (!publishReady) return;
                  setPublishOpen(true);
                }}
              >
                Publish sale
              </DropdownMenuItem>
            ) : null}
            {canPublish && !publishReady ? (
              <DropdownMenuItem asChild>
                <Link href={adminSaleSetupHref(saleId, "review")}>Continue setup</Link>
              </DropdownMenuItem>
            ) : null}
            {canUnpublish ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmKind("unpublish");
                }}
              >
                Revert to draft
              </DropdownMenuItem>
            ) : null}
            {canMarkOnsiteEnded ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmKind("markEnded");
                }}
              >
                Mark onsite sale ended
              </DropdownMenuItem>
            ) : null}
            {canCancel ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmKind("cancel");
                }}
              >
                Cancel sale
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                disabled={pending}
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                Delete sale
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={salePath({ id: saleId, title: saleTitle })}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 size-4 opacity-70" aria-hidden />
                View on site
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="ghost" size="sm" asChild>
          <Link href={salePath({ id: saleId, title: saleTitle })} target="_blank" rel="noreferrer">
            View on site
          </Link>
        </Button>
      )}
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
      {copy && confirmKind ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmKind(null);
          }}
          title={copy.title}
          body={copy.description}
          confirmLabel={copy.actionLabel}
          onConfirm={() => {
            if (confirmKind === "unpublish") unpublish();
            if (confirmKind === "markEnded") markOnsiteEnded();
            if (confirmKind === "cancel") cancel();
            setConfirmKind(null);
          }}
        />
      ) : null}
    </div>
  );
}
