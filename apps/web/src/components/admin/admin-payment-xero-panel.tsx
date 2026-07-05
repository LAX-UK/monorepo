"use client";

import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { adminPaymentXeroSyncResultAction } from "@/lib/actions/admin";
import { xeroSyncStatusLabel } from "@/lib/admin/xero-sync-status-presenter";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
    <div className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Xero
      </p>
      {p.xeroInvoiceNumber ? (
        <p className="font-body text-sm text-on-surface">
          Invoice <span className="font-medium">{p.xeroInvoiceNumber}</span>
        </p>
      ) : null}
      {p.xeroSyncStatus ? (
        <p className="font-body text-xs text-on-surface-variant">
          Sync: <span className="text-on-surface">{xeroSyncStatusLabel(p.xeroSyncStatus)}</span>
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
                notify.error(r.error);
                return;
              }
              notify.success("Synced from Xero");
              router.refresh();
            })();
          });
        }}
      >
        {pending ? "Syncing…" : "Sync from Xero"}
      </Button>
      <AdminTechnicalIdDisclosure
        triggerLabel="Show Xero reference IDs"
        items={[
          ...(p.xeroSyncStatus
            ? [
                {
                  label: "Sync status code",
                  value: p.xeroSyncStatus,
                  copyLabel: "Xero sync status",
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
