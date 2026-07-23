"use client";

import { adminSoftDeleteSaleResultAction } from "@/lib/actions/admin-sales";
import {
  adminCancelSaleResultAction,
  adminMarkSaleEndedResultAction,
  adminPublishSaleResultAction,
  adminUnpublishSaleResultAction,
} from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import type { ActionResult } from "@/lib/forms/form-result";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export const SALE_PUBLISH_PHRASE = "PUBLISH";

export function useSaleLifecycleActions(saleId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const promoteConnectToShell = (detail?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("error_code", "connect_required");
    if (detail?.trim()) {
      params.set("error", detail.trim());
    } else {
      params.delete("error");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          notify.success("Done");
          router.refresh();
          return;
        }
        if (r.errorCode === "connect_required") {
          promoteConnectToShell(
            humanizeSetupError({
              message: r.error,
              errorCode: r.errorCode,
            }),
          );
          return;
        }
        notify.error(
          actionFailureNotifyMessage(r.error, {
            status: r.status,
            errorCode: r.errorCode,
            meta: r.meta,
          }),
        );
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
