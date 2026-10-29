import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DomainStatusBadge } from "@/components/ui/domain-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import {
  ACCOUNT_LOAD_ERROR,
  DASHBOARD_EMPTY,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard/dashboard-copy";
import type {
  PayoutDestinationVm,
  PayoutRow,
  SoldAndPayoutsVm,
  SoldWorkRow,
} from "@/lib/seller/sold-and-payouts.vm";
import { Button } from "@auction/ui/components/button";
import { CreditCard, FileText } from "lucide-react";
import Link from "next/link";

function PayoutDestinationCard({ vm }: { vm: PayoutDestinationVm }) {
  return (
    <section
      aria-label="Where payouts go"
      className="flex flex-col gap-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:gap-5 md:p-5"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high text-on-surface max-sm:hidden"
      >
        <CreditCard className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-body text-base font-semibold text-on-surface">
          {vm.ready ? "Payouts go to your bank account" : "Set up payouts to be paid"}
        </h2>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          {vm.ready
            ? "Through our secure payment partner. We never see or store your bank details."
            : "Add your bank details so we can pay you when a work sells."}
          {vm.pending ? ` ${vm.pending} is waiting for the next payout.` : ""}
        </p>
      </div>
      <Button
        asChild
        size="default"
        variant={vm.ready ? "secondaryOutline" : "primary"}
        className="shrink-0 max-sm:w-full"
      >
        <Link href={DASHBOARD_ROUTES.sellerConnect}>
          {vm.ready ? "Manage payouts" : "Set up payouts"}
        </Link>
      </Button>
    </section>
  );
}

const TABLE_HEAD =
  "px-4 py-3 text-left font-body text-xs font-medium text-on-surface-variant md:px-5";
const TABLE_CELL = "px-4 py-3.5 font-body text-sm text-on-surface md:px-5";

function SoldWorks({ rows }: { rows: readonly SoldWorkRow[] }) {
  return (
    <section aria-labelledby="sold-heading" className="flex flex-col gap-4">
      <h2 id="sold-heading" className="font-headline text-lg font-semibold text-on-surface">
        Sold
      </h2>
      <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
        <table className="w-full">
          <thead className="border-b border-outline-variant/50 max-md:sr-only">
            <tr>
              <th scope="col" className={TABLE_HEAD}>
                Work
              </th>
              <th scope="col" className={TABLE_HEAD}>
                Sale
              </th>
              <th scope="col" className={`${TABLE_HEAD} text-right`}>
                Hammer
              </th>
              <th scope="col" className={`${TABLE_HEAD} text-right`}>
                Sold on
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {rows.map((row) => (
              <tr key={row.lotId} className="max-md:flex max-md:flex-wrap max-md:items-center">
                <td className={`${TABLE_CELL} max-md:w-full max-md:pb-1`}>
                  <span className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                      <MediaImage src={row.image} alt="" label="Lot image" sizes="48px" />
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={row.href}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {row.title}
                      </Link>
                      {row.lotLabel ? (
                        <span className="block text-xs text-on-surface-variant">
                          {row.lotLabel}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td
                  className={`${TABLE_CELL} text-on-surface-variant max-md:flex-1 max-md:pt-1 max-md:pl-19`}
                >
                  {row.saleTitle ?? "—"}
                </td>
                <td className={`${TABLE_CELL} text-right font-medium tabular-nums max-md:pt-1`}>
                  {row.hammer}
                </td>
                <td className={`${TABLE_CELL} text-right text-on-surface-variant max-md:hidden`}>
                  {row.soldOn}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Payouts({ rows }: { rows: readonly PayoutRow[] }) {
  return (
    <section aria-labelledby="payouts-heading" className="flex flex-col gap-4">
      <h2 id="payouts-heading" className="font-headline text-lg font-semibold text-on-surface">
        Payouts
      </h2>
      <ul className="divide-y divide-outline-variant/50 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:px-5"
          >
            <div className="min-w-0">
              <p className="font-body text-sm font-medium text-on-surface">{row.period}</p>
              <p className="mt-0.5 font-body text-xs tabular-nums text-on-surface-variant">
                Sales {row.gross} · Commission and fees {row.fees}
              </p>
            </div>
            <p className="text-right font-body text-base font-semibold tabular-nums text-on-surface">
              <span className="sr-only">You receive </span>
              {row.net}
            </p>
            <DomainStatusBadge domain="payout" status={row.status} />
            <Button variant="ghost" size="default" asChild className="justify-self-end">
              <a href={row.statementHref}>
                <FileText aria-hidden />
                Statement
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Sold & payouts: where payouts go, the works that sold and each payout with its statement.
 * `vm` is `null` when the payouts could not be read.
 */
export function SoldAndPayoutsView({ vm }: { vm: SoldAndPayoutsVm | null }) {
  if (!vm) return <AccountLoadError {...ACCOUNT_LOAD_ERROR.payouts} />;
  const nothingYet = vm.sold.length === 0 && vm.payouts.length === 0;
  return (
    <div className="flex flex-col gap-8">
      <PayoutDestinationCard vm={vm.destination} />
      {nothingYet ? (
        <DashboardEmptyState
          illustration="ledger"
          title={DASHBOARD_EMPTY.sellerPayouts.title}
          description={DASHBOARD_EMPTY.sellerPayouts.description}
        />
      ) : (
        <>
          {vm.sold.length > 0 ? <SoldWorks rows={vm.sold} /> : null}
          {vm.payouts.length > 0 ? <Payouts rows={vm.payouts} /> : null}
        </>
      )}
    </div>
  );
}
