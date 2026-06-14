"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { formatExposurePence } from "@/lib/data/view-models/admin-sof-table.vm";
import Link from "next/link";

type Props = {
  detail: AdminSourceOfFundsDetail;
};

function paymentStatusLabel(status: string | undefined): string {
  if (!status) return "—";
  return status.replaceAll("_", " ");
}

export function SofSettlementBreakdown({ detail }: Props) {
  const {
    settlementItems,
    exposureAtOpenPence,
    currentActiveExposurePence,
    case: caseRow,
  } = detail;
  const currency = caseRow.currency || "GBP";

  if (settlementItems.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        No active payments or won lots awaiting checkout. The case may have been opened from a risk
        indicator or manual compliance flag.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-outline-variant/40">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low">
              <th className="px-3 py-2 font-label text-[10px] uppercase text-on-surface-variant">
                Sale
              </th>
              <th className="px-3 py-2 font-label text-[10px] uppercase text-on-surface-variant">
                Lot
              </th>
              <th className="px-3 py-2 font-label text-[10px] uppercase text-on-surface-variant">
                Amount
              </th>
              <th className="px-3 py-2 font-label text-[10px] uppercase text-on-surface-variant">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {settlementItems.map((item) => {
              const lotRef =
                item.lotNumber == null ? item.lotTitle : `Lot ${item.lotNumber} · ${item.lotTitle}`;
              const status =
                item.kind === "won_unpaid"
                  ? "Checkout not started (estimated)"
                  : paymentStatusLabel(item.paymentStatus);
              return (
                <tr
                  key={`${item.kind}-${item.lotId}-${item.paymentId ?? "none"}`}
                  className="border-b border-outline-variant/20 last:border-0"
                >
                  <td className="px-3 py-2">
                    {item.saleId ? (
                      <Link href={`/admin/sales/${item.saleId}`} className="text-link underline">
                        {item.saleTitle || "Sale"}
                      </Link>
                    ) : (
                      <span>{item.saleTitle || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/lots/${item.lotId}`} className="text-link underline">
                      {lotRef}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatExposurePence(item.amountPence, currency)}
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-body text-xs text-on-surface-variant">
        Exposure at case open: {formatExposurePence(exposureAtOpenPence, currency)}. Current active
        payment total: {formatExposurePence(currentActiveExposurePence, currency)}. Totals may
        differ if settlements changed after the case opened. Won-but-unpaid lots are shown for
        context only and are not included in the active payment total.
      </p>
    </div>
  );
}
