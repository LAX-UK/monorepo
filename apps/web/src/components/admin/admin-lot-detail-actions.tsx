"use client";

import {
  adminCancelLotResultAction,
  adminPublishLotResultAction,
} from "@/lib/actions/admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type Props = {
  lotId: string;
  canPublish: boolean;
  canCancel: boolean;
  showEditDraft: boolean;
};

export function AdminLotDetailActions({ lotId, canPublish, canCancel, showEditDraft }: Props) {
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
      {canPublish ? (
        <button
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
          className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-primary shadow-sm hover:opacity-95 disabled:opacity-60"
        >
          Publish
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
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
          className="inline-flex items-center justify-center rounded-md border border-error/40 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-error hover:bg-error/10 disabled:opacity-60"
        >
          Cancel auction
        </button>
      ) : null}
    </div>
  );
}
