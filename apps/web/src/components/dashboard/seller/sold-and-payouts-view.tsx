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
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui";
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

function SoldWorks({ rows }: { rows: readonly SoldWorkRow[] }) {
  return (
    <section aria-labelledby="sold-heading" className="flex flex-col gap-4">
      <h2 id="sold-heading" className="font-headline text-lg font-semibold text-on-surface">
        Sold
      </h2>
      <RecordList aria-labelledby="sold-heading">
        {rows.map((row) => (
          <RecordRow
            key={row.lotId}
            href={row.href}
            linkAs={Link}
            leading={
              <RecordRowMedia>
                <MediaImage src={row.image} alt="" sizes="48px" />
              </RecordRowMedia>
            }
            title={row.title}
            meta={[row.lotLabel, row.saleTitle, `Sold ${row.soldOn}`]}
            value={
              <>
                <span className="sr-only">Hammer price </span>
                {row.hammer}
              </>
            }
          />
        ))}
      </RecordList>
    </section>
  );
}

function Payouts({ rows }: { rows: readonly PayoutRow[] }) {
  return (
    <section aria-labelledby="payouts-heading" className="flex flex-col gap-4">
      <h2 id="payouts-heading" className="font-headline text-lg font-semibold text-on-surface">
        Payouts
      </h2>
      <RecordList aria-labelledby="payouts-heading">
        {rows.map((row) => (
          <RecordRow
            key={row.id}
            title={row.period}
            meta={[`Sales ${row.gross}`, `Commission and fees ${row.fees}`]}
            status={<DomainStatusBadge domain="payout" status={row.status} />}
            value={
              <>
                <span className="sr-only">You receive </span>
                {row.net}
              </>
            }
            action={
              <Button variant="ghost" size="default" asChild>
                <a href={row.statementHref} aria-label={`Statement for ${row.period}`}>
                  <FileText aria-hidden />
                  Statement
                </a>
              </Button>
            }
          />
        ))}
      </RecordList>
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
