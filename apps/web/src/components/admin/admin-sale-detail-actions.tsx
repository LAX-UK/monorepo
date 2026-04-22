"use client";

import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import type { ActionResult } from "@/lib/forms/form-result";
import {
  adminAttachLotToSaleResultAction,
  adminCancelSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminPublishSaleResultAction,
} from "@/lib/actions/admin-sales";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type LotRow = { id: string; title: string; lotNumber: number | null; status: string };

type Props = {
  saleId: string;
  canEdit: boolean;
  canPublish: boolean;
  canCancel: boolean;
  lots: LotRow[];
  draftOrphans: { id: string; title: string }[];
};

export function AdminSaleDetailActions({
  saleId,
  canEdit,
  canPublish,
  canCancel,
  lots,
  draftOrphans,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          toast.success("Done");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link
            href={`/admin/sales/${saleId}/edit`}
            className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
          >
            Edit draft
          </Link>
        ) : null}
        {canPublish ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => adminPublishSaleResultAction(saleId))}
          >
            Publish
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            disabled={pending}
            variant="secondary"
            onClick={() => run(() => adminCancelSaleResultAction(saleId))}
          >
            Cancel sale
          </Button>
        ) : null}
        <Link
          href={`/sales/${saleId}`}
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
        >
          View on site
        </Link>
      </div>

      <div>
        <DisplayHeading as="h2" className="text-2xl">
          Catalog lots
        </DisplayHeading>
        <ul className="mt-4 divide-y divide-outline-variant/15 rounded-xl border border-outline-variant/15">
          {lots.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-headline text-base">{l.title}</p>
                <p className="text-xs text-on-surface-variant">
                  Lot #{l.lotNumber ?? "—"} · {l.status}
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  disabled={pending}
                  variant="secondary"
                  onClick={() =>
                    run(() => adminDetachLotFromSaleResultAction(saleId, l.id))
                  }
                >
                  Detach
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {canEdit && draftOrphans.length > 0 ? (
        <div>
          <DisplayHeading as="h2" className="text-2xl">
            Attach draft lot
          </DisplayHeading>
          <p className="mt-2 text-sm text-on-surface-variant">
            Standalone draft lots only. After attach, set schedule on the lot if needed.
          </p>
          <ul className="mt-4 space-y-3">
            {draftOrphans.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/15 px-4 py-3"
              >
                <span className="font-body text-sm">{l.title}</span>
                <Button
                  type="button"
                  disabled={pending}
                  variant="secondary"
                  onClick={() => run(() => adminAttachLotToSaleResultAction(saleId, l.id))}
                >
                  Attach
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
