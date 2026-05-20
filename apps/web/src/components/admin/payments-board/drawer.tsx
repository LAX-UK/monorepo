"use client";

import { AdminPaymentXeroPanel } from "@/components/admin/admin-payment-xero-panel";
import {
  AdminPaymentActions,
  type AdminPaymentTableRow,
} from "@/components/admin/admin-payments-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import Link from "next/link";

export function PaymentDrawerContent({
  p,
  onClose,
}: {
  p: AdminPaymentTableRow;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot
        </p>
        <Link
          href={`/admin/lots/${p.lotId}`}
          className="font-headline text-base text-primary hover:underline"
          onClick={onClose}
        >
          {p.lotTitle}
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Payment ID</dt>
          <dd className="font-mono text-xs">{p.id}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Buyer</dt>
          <dd className="font-mono text-xs break-all">{p.buyerId}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Seller</dt>
          <dd className="font-mono text-xs break-all">{p.sellerId}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Amount</dt>
          <dd className="tabular-nums">{p.amount}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Platform fee</dt>
          <dd className="tabular-nums">{p.platformFee}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
          <dd>
            <AdminStatusBadge domain="payment" status={p.status} />
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Fulfilment</dt>
          <dd className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
            {p.fulfilmentStatus ? p.fulfilmentStatus.replaceAll("_", " ") : "—"}
          </dd>
        </div>
      </dl>

      <AdminPaymentXeroPanel
        id={p.id}
        xeroInvoiceNumber={p.xeroInvoiceNumber}
        xeroOnlineInvoiceUrl={p.xeroOnlineInvoiceUrl}
        xeroSyncStatus={p.xeroSyncStatus}
        xeroLastError={p.xeroLastError}
      />

      <AdminPaymentActions id={p.id} status={p.status} fullWidth />
    </div>
  );
}
