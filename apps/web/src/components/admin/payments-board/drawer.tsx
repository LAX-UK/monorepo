"use client";

import { AdminPaymentXeroPanel } from "@/components/admin/admin-payment-xero-panel";
import {
  AdminPaymentActions,
  type AdminPaymentTableRow,
} from "@/components/admin/admin-payments-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
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
          className="font-headline text-base text-link hover:underline"
          onClick={onClose}
        >
          {p.lotTitle}
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Buyer</dt>
          <dd>
            <Link
              href={`/admin/clients/${encodeURIComponent(p.buyerId)}`}
              className="font-medium text-link underline"
              onClick={onClose}
            >
              {p.buyerLabel?.trim() || "View buyer profile"}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Seller</dt>
          <dd>
            <Link
              href={`/admin/clients/${encodeURIComponent(p.sellerId)}`}
              className="font-medium text-link underline"
              onClick={onClose}
            >
              View seller profile
            </Link>
          </dd>
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
          <dd>
            {p.fulfilmentStatus ? (
              <AdminStatusBadge domain="fulfilment" status={p.fulfilmentStatus} />
            ) : (
              <span className="text-on-surface-variant">—</span>
            )}
          </dd>
        </div>
      </dl>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Payment ID", value: p.id },
          { label: "Buyer ID", value: p.buyerId },
          { label: "Seller ID", value: p.sellerId },
        ]}
      />

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
