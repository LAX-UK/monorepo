"use client";

import type {
  RowRateSource,
  SettlementDealRow,
  SettlementRow,
} from "@/lib/admin/seller-proceeds/settlement-preview.vm";
import { StaffButton, TextLink, cn, formatStaffExportDate } from "@auction/staff-ui";
import Link from "next/link";

/** Where a row's rate comes from, in a cell: the agreement and when it was signed. */
export function RateSourceCell({ source }: { source: RowRateSource }) {
  if (!source) return <span className="text-staff-muted">—</span>;
  return (
    <span className="flex flex-col">
      <TextLink href={source.href} Link={Link}>
        Agreement {source.reference}
      </TextLink>
      <span className="text-staff-xs text-staff-muted">
        {source.kind === "recorded_by_staff"
          ? "Recorded by staff"
          : source.signedAt
            ? `Signed ${formatStaffExportDate(source.signedAt)}`
            : null}
      </span>
    </span>
  );
}

const HEAD =
  "border-b border-staff-line px-3 py-2 text-left text-staff-xs font-medium text-staff-muted";
const CELL = "border-b border-staff-line-subtle px-3 py-2 align-top";
const NUM = "text-right tabular-nums whitespace-nowrap";

/**
 * Every waiting sale on a settlement preview, one row each, with the breakdown's columns. A held
 * sale stays in its place, tinted red, with the reason and (when recording fixes it) the action.
 * Wide tables scroll inside their frame on a phone.
 */
export function SettlementSalesTable({
  rows,
  onRecord,
}: {
  rows: readonly SettlementRow[];
  onRecord?: (row: SettlementRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-staff-lg border border-staff-line">
      <table className="w-full min-w-[720px] border-collapse text-staff-sm">
        <caption className="sr-only">Sales waiting to settle</caption>
        <thead>
          <tr>
            <th scope="col" className={HEAD}>
              Lot
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Hammer
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Commission
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              VAT on commission
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Net to the seller
            </th>
            <th scope="col" className={HEAD}>
              Rate from
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-held={row.held ? "" : undefined}
              className={row.held ? "bg-staff-danger-bg text-staff-danger-fg" : undefined}
            >
              <th scope="row" className={cn(CELL, "text-left font-normal")}>
                <span className="flex flex-col">
                  {row.lotHref ? (
                    <TextLink href={row.lotHref} Link={Link}>
                      {row.lot}
                    </TextLink>
                  ) : (
                    <span className="font-medium">{row.lot}</span>
                  )}
                  {row.lotTitle ? (
                    <span className={cn("text-staff-xs", row.held ? "" : "text-staff-muted")}>
                      {row.lotTitle}
                    </span>
                  ) : null}
                </span>
              </th>
              <td className={cn(CELL, NUM)}>{row.hammer}</td>
              {row.held ? (
                <td className={CELL} colSpan={4}>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">Payout held:</span> {row.held.reason}
                    </span>
                    {row.held.canRecord && onRecord ? (
                      <StaffButton size="sm" variant="secondary" onClick={() => onRecord(row)}>
                        Record signed agreement
                      </StaffButton>
                    ) : null}
                  </span>
                </td>
              ) : (
                <>
                  <td className={cn(CELL, NUM)}>
                    <span className="text-staff-muted">{row.commissionRate}</span> {row.commission}
                  </td>
                  <td className={cn(CELL, NUM)}>
                    <span className="text-staff-muted">{row.vatRate}</span> {row.vat}
                  </td>
                  <td className={cn(CELL, NUM, "font-medium")}>{row.net}</td>
                  <td className={CELL}>
                    <RateSourceCell source={row.rateSource} />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The released private sales the run pays beside the lots, each split as the run splits it: the
 * price, less the commission and the agreed costs.
 */
export function SettlementDealsTable({ rows }: { rows: readonly SettlementDealRow[] }) {
  return (
    <div className="overflow-x-auto rounded-staff-lg border border-staff-line">
      <table className="w-full min-w-[560px] border-collapse text-staff-sm">
        <caption className="sr-only">Private sales waiting to settle</caption>
        <thead>
          <tr>
            <th scope="col" className={HEAD}>
              Private sale
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Price
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Commission
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Costs
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Net to seller
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className={cn(CELL, "text-left font-medium")}>
                {row.reference}
              </th>
              <td className={cn(CELL, NUM)}>{row.price}</td>
              <td className={cn(CELL, NUM)}>{row.commission}</td>
              <td className={cn(CELL, NUM)}>{row.costs}</td>
              <td className={cn(CELL, NUM, "font-medium")}>{row.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
