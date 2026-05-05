"use client";

import { adminCancelLotResultAction, adminPublishLotResultAction } from "@/lib/actions/admin";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type Props = {
  lotId: string;
  canPublish: boolean;
  canCancel: boolean;
  showEditDraft: boolean;
  /** Draft + scheduled + active: open /edit for catalog (core form only for draft). */
  showEditCatalog: boolean;
};

export function AdminLotDetailActions({
  lotId,
  canPublish,
  canCancel,
  showEditDraft,
  showEditCatalog,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
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
                  toast.success("Published");
                  router.refresh();
                  return;
                }
                toast.error(r.error);
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
                  toast.success("Auction cancelled");
                  router.refresh();
                  return;
                }
                toast.error(r.error);
              })();
            });
          }}
          className="h-auto rounded-md border border-error/40 bg-transparent px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-error hover:bg-error/10 hover:text-error disabled:opacity-60"
        >
          Cancel auction
        </Button>
      ) : null}
    </div>
  );
}
