"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { formatExposurePence } from "@/lib/data/view-models/admin-sof-table.vm";
import { type StaffLinkComponent, TextLink } from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  detail: AdminSourceOfFundsDetail;
};

function paymentStatusLabel(status: string | undefined): string {
  if (!status) return "—";
  const text = status.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const HEAD = "px-3 py-2 text-left text-staff-xs font-medium text-staff-muted";

/** The payments and won lots this case holds up, and the exposure they add up to. */
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
      <p className="text-staff-sm text-staff-muted">
        No active payments or won lots awaiting checkout. The case may have been opened from a risk
        indicator or manual compliance flag.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-staff-lg border border-staff-line">
        <table className="w-full min-w-[32rem] text-left text-staff-sm">
          <caption className="sr-only">Payments and won lots held by this case</caption>
          <thead>
            <tr className="border-b border-staff-line bg-staff-sunken">
              <th scope="col" className={HEAD}>
                Sale
              </th>
              <th scope="col" className={HEAD}>
                Lot
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Amount
              </th>
              <th scope="col" className={HEAD}>
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
                  className="border-b border-staff-line-subtle last:border-0"
                >
                  <td className="px-3 py-2">
                    {item.saleId ? (
                      <TextLink Link={NextLink} href={`/admin/sales/${item.saleId}`}>
                        {item.saleTitle || "Sale"}
                      </TextLink>
                    ) : (
                      <span>{item.saleTitle || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <TextLink Link={NextLink} href={`/admin/lots/${item.lotId}`}>
                      {lotRef}
                    </TextLink>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatExposurePence(item.amountPence, currency)}
                  </td>
                  <td className="px-3 py-2 text-staff-muted">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-staff-xs text-staff-muted">
        Exposure at case open: {formatExposurePence(exposureAtOpenPence, currency)}. Current active
        payment total: {formatExposurePence(currentActiveExposurePence, currency)}. Totals may
        differ if settlements changed after the case opened. Won-but-unpaid lots are shown for
        context only and are not included in the active payment total.
      </p>
    </div>
  );
}
