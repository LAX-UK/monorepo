import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PayoutDetailVm } from "@/lib/seller/payout-detail.vm";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

const CELL = "px-4 py-3 text-lax-14 md:px-5";

/**
 * One payout: what was paid and where it is, then each lot with its hammer, LAX's commission
 * and fees, and what the seller receives. On a phone each lot is a short block instead of a
 * table row.
 */
export function PayoutDetail({ vm }: { vm: PayoutDetailVm }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`${CLIENT_ROUTES.payouts}?tab=payouts`}
          className="inline-flex w-fit items-center gap-1 text-lax-13 text-lax-muted hover:text-lax-fg lax-focus"
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          Payouts
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1
              className="font-lax-display text-lax-28 font-semibold text-lax-fg"
              data-page-title=""
            >
              {vm.title}
            </h1>
            <p className="mt-1 text-lax-14 text-lax-muted">{vm.subtitle}</p>
          </div>
          <ButtonLink href={vm.statementHref} icon={<Download aria-hidden />} className="w-fit">
            Download statement (PDF)
          </ButtonLink>
        </div>
      </div>

      <dl className="grid overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface md:grid-cols-3">
        <div className="flex flex-col gap-1 border-b border-lax-line p-5 md:border-r md:border-b-0">
          <dt className="text-lax-13 text-lax-muted">Sales</dt>
          <dd className="font-lax-display text-lax-24 font-semibold tabular-nums text-lax-fg">
            {vm.gross}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-lax-line p-5 md:border-r md:border-b-0">
          <dt className="text-lax-13 text-lax-muted">Commission and fees</dt>
          <dd className="font-lax-display text-lax-24 font-semibold tabular-nums text-lax-fg">
            {vm.fees}
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <dt className="text-lax-13 text-lax-muted">Status</dt>
          <dd className="flex flex-col items-start gap-1">
            <StatusBadge tone={vm.status.tone} shape={vm.status.shape}>
              {vm.status.label}
            </StatusBadge>
            {vm.statusNote ? (
              <span className="text-lax-13 text-lax-muted">{vm.statusNote}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="payout-lots" className="flex flex-col gap-3">
        <h2
          id="payout-lots"
          className="flex items-baseline gap-2 font-lax-display text-lax-18 font-semibold text-lax-fg"
        >
          In this payout
          <span className="text-lax-14 font-normal text-lax-muted">{vm.lines.length}</span>
        </h2>
        <div className="overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
          <table className="w-full max-md:hidden">
            <thead>
              <tr className="border-b border-lax-line text-left text-lax-13 text-lax-muted">
                <th scope="col" className={`${CELL} font-normal`}>
                  Work
                </th>
                <th scope="col" className={`${CELL} font-normal`}>
                  Lot
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  Hammer
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  Commission and fees
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  You receive
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lax-line">
              {vm.lines.map((line) => (
                <tr key={line.id}>
                  <td className={`${CELL} text-lax-fg`}>
                    {line.work}
                    {line.note ? (
                      <span className="block text-lax-13 text-lax-muted">{line.note}</span>
                    ) : null}
                  </td>
                  <td className={`${CELL} text-lax-muted`}>{line.lot}</td>
                  <td className={`${CELL} text-right tabular-nums text-lax-fg`}>{line.hammer}</td>
                  <td className={`${CELL} text-right tabular-nums text-lax-fg`}>{line.fees}</td>
                  <td className={`${CELL} text-right font-semibold tabular-nums text-lax-fg`}>
                    {line.receive}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-lax-line">
                <th
                  scope="row"
                  colSpan={4}
                  className={`${CELL} text-left font-semibold text-lax-fg`}
                >
                  Total
                </th>
                <td className={`${CELL} text-right font-semibold tabular-nums text-lax-fg`}>
                  {vm.total}
                </td>
              </tr>
            </tfoot>
          </table>
          <ul className="divide-y divide-lax-line md:hidden">
            {vm.lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-lax-14 font-medium text-lax-fg">{line.work}</p>
                  <p className="shrink-0 text-lax-14 font-semibold tabular-nums text-lax-fg">
                    {line.receive}
                  </p>
                </div>
                {line.hammer ? (
                  <p className="text-lax-13 text-lax-muted">
                    {[line.lot, `hammer ${line.hammer}`, `commission and fees ${line.fees}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : line.note ? (
                  <p className="text-lax-13 text-lax-muted">{line.note}</p>
                ) : null}
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 p-4">
              <p className="text-lax-14 font-semibold text-lax-fg">Total</p>
              <p className="text-lax-14 font-semibold tabular-nums text-lax-fg">{vm.total}</p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
