"use client";

import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { adminPaymentXeroSyncResultAction } from "@/lib/actions/admin";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type Props = Pick<
  AdminPaymentTableRow,
  "id" | "xeroInvoiceNumber" | "xeroOnlineInvoiceUrl" | "xeroSyncStatus" | "xeroLastError"
>;

export function AdminPaymentXeroPanel(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hasXeroRow =
    p.xeroSyncStatus != null || p.xeroOnlineInvoiceUrl != null || p.xeroInvoiceNumber != null;

  if (!hasXeroRow) {
    return (
      <p className="font-body text-xs text-on-surface-variant">
        No Xero invoice linked yet (checkout may not have run with Xero connected).
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 p-4">
      <p className="font-label text-[10px] uppercase tracking-widest text-secondary">Xero</p>
      {p.xeroInvoiceNumber ? (
        <p className="font-body text-sm text-on-surface">
          Invoice <span className="font-mono text-xs">{p.xeroInvoiceNumber}</span>
        </p>
      ) : null}
      {p.xeroSyncStatus ? (
        <p className="font-body text-xs text-on-surface-variant">
          Sync: <span className="font-mono">{p.xeroSyncStatus}</span>
        </p>
      ) : null}
      {p.xeroLastError ? (
        <p className="font-body text-xs text-error" role="alert">
          {p.xeroLastError}
        </p>
      ) : null}
      {p.xeroOnlineInvoiceUrl ? (
        <Button asChild variant="secondary" className="min-h-11 w-full">
          <a href={p.xeroOnlineInvoiceUrl} target="_blank" rel="noopener noreferrer">
            Open online invoice
          </a>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 w-full"
        disabled={pending}
        onClick={() => {
          start(() => {
            void (async () => {
              const r = await adminPaymentXeroSyncResultAction(p.id);
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success("Synced from Xero");
              router.refresh();
            })();
          });
        }}
      >
        {pending ? "Syncing…" : "Sync from Xero"}
      </Button>
    </div>
  );
}
