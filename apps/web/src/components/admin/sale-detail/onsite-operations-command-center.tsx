import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { Sale } from "@auction/types";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot | null;
};

export function OnsiteOperationsCommandCenter({ saleId, sale, liveish, snapshot }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Operations command center"
      description="Live saleroom status, pending registrations, and telephone line workload."
      framed={false}
    >
      {!liveish ? (
        <p className="font-body text-sm text-on-surface-variant">
          Operations tooling activates when this sale is scheduled or live. Current status:{" "}
          <strong className="capitalize">{sale.status}</strong>.
        </p>
      ) : null}

      {snapshot ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Saleroom" value={snapshot.saleroomSession?.status ?? "none"} />
            <MetricCard
              label="Pending registrations"
              value={String(snapshot.registrations.pending)}
            />
            <MetricCard
              label="Telephone requested"
              value={String(snapshot.telephoneBookings.requested)}
            />
            <MetricCard
              label="Telephone in progress"
              value={String(snapshot.telephoneBookings.inProgress)}
            />
          </div>

          {snapshot.saleroomSession?.currentLotTitle ? (
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
              <h3 className="font-headline text-base text-on-surface">On the block</h3>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Lot {snapshot.saleroomSession.currentLotNumber ?? "—"} ·{" "}
                {snapshot.saleroomSession.currentLotTitle}
              </p>
              {snapshot.currentLotBidding ? (
                <p className="mt-1 font-body text-sm tabular-nums text-on-surface">
                  {formatMoney(snapshot.currentLotBidding.currentPrice)} ·{" "}
                  {snapshot.currentLotBidding.bidCount} bid
                  {snapshot.currentLotBidding.bidCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard
              title="Open saleroom console"
              description="Advance lots, hammer, and manage live telephone lines."
              href={`/admin/saleroom/${saleId}`}
              cta="Open console →"
            />
            <ActionCard
              title="Telephone bookings"
              description={`${snapshot.telephoneBookings.requested} awaiting confirmation.`}
              href={saleDetailTabHref(saleId, "telephone-bookings")}
              cta="Manage lines →"
            />
          </div>

          {snapshot.pendingActions.telephone.length > 0 ? (
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
              <h3 className="font-headline text-base text-on-surface">
                Pending telephone requests
              </h3>
              <ul className="mt-3 space-y-2 font-body text-sm">
                {snapshot.pendingActions.telephone.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{row.userName ?? row.userEmail ?? row.userId}</span>
                    <span className="text-on-surface-variant">
                      {row.phoneDisplay ?? row.phoneE164}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="font-body text-sm text-on-surface-variant">
          Could not load the live operations snapshot for this sale.
        </p>
      )}

      {sale.startTime ? (
        <p className="font-body text-xs text-on-surface-variant">
          Sale starts {formatDateTime(sale.startTime)}
        </p>
      ) : null}
    </CatalogDetailTabPanel>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-4">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <p className="mt-2 font-headline text-xl capitalize text-on-surface">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border-hairline bg-surface-container-low/40 p-5 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <h3 className="font-headline text-base text-on-surface">{title}</h3>
      <p className="mt-2 font-body text-sm text-on-surface-variant">{description}</p>
      <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
        {cta}
      </span>
    </Link>
  );
}
