"use client";

import {
  adminCancelSaleResultAction,
  adminMarkSaleEndedResultAction,
  adminPublishSaleResultAction,
  adminSoftDeleteSaleResultAction,
  adminUnpublishSaleResultAction,
} from "@/lib/actions/admin-sales";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export const SALE_PUBLISH_PHRASE = "PUBLISH";

export function useSaleLifecycleActions(saleId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          notify.success("Done");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return {
    pending,
    publish: () => run(() => adminPublishSaleResultAction(saleId)),
    unpublish: () => run(() => adminUnpublishSaleResultAction(saleId)),
    markOnsiteEnded: () => run(() => adminMarkSaleEndedResultAction(saleId)),
    cancel: () => run(() => adminCancelSaleResultAction(saleId)),
    softDelete: (confirmationPhrase: string) =>
      startTransition(() => {
        void (async () => {
          const r = await adminSoftDeleteSaleResultAction(saleId, confirmationPhrase);
          if (r.ok) {
            notify.success("Sale deleted");
            router.push("/admin/sales");
            return;
          }
          notify.error(r.error);
        })();
      }),
  };
}
