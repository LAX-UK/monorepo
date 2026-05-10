"use client";

import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { adminCancelLotResultAction, adminPublishLotResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [connectRequired, setConnectRequired] = useState(false);

  return (
    <div className="space-y-4">
      {connectRequired ? (
        <AdminLotConnectRequiredBanner sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
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
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                void (async () => {
                  const r = await adminPublishLotResultAction(lotId);
                  if (r.ok) {
                    setConnectRequired(false);
                    notify.success("Published");
                    router.refresh();
                    return;
                  }
                  if (!r.ok && r.errorCode === "connect_required") {
                    setConnectRequired(true);
                    return;
                  }
                  if (!r.ok) notify.error(r.error);
                })();
              });
            }}
            className="h-auto rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-primary shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            Publish
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                void (async () => {
                  const r = await adminCancelLotResultAction(lotId, {});
                  if (r.ok) {
                    notify.success("Auction cancelled");
                    router.refresh();
                    return;
                  }
                  notify.error(r.error);
                })();
              });
            }}
            className="h-auto rounded-md border border-error/40 bg-transparent px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-error hover:bg-error/10 hover:text-error disabled:opacity-60"
          >
            Cancel auction
          </Button>
        ) : null}
      </div>
    </div>
  );
}
