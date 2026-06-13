import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin.server";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type OnsiteSalesRadarRow = {
  saleId: string;
  title: string;
  status: string;
  pendingRegistrations: number;
  pendingTelephone: number;
  inProgressTelephone: number;
};

type Props = {
  rows: OnsiteSalesRadarRow[];
};

export function OnsiteSalesRadarWidget({ rows }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">
            Onsite sales radar
          </h3>
          <p className="font-body text-sm text-on-surface-variant">
            Live onsite sales with pending registrations or telephone line work.
          </p>
        </div>
        <Link
          href="/admin/saleroom"
          className="inline-flex min-h-9 shrink-0 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
        >
          Saleroom
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">
          No onsite sales need immediate operations attention.
        </p>
      ) : (
        <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
          {rows.map((row) => (
            <li key={row.saleId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  href={saleDetailTabHref(row.saleId, "operations")}
                  className="font-medium text-link hover:underline"
                >
                  {row.title}
                </Link>
                <p className="mt-1 font-body text-xs text-on-surface-variant capitalize">
                  {row.status} · {row.pendingRegistrations} reg
                  {row.pendingRegistrations === 1 ? "" : "s"} · {row.pendingTelephone} tel pending
                </p>
              </div>
              <Link
                href={`/admin/saleroom/${row.saleId}`}
                className="font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
              >
                Console
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

export function mapOperationsSnapshotToRadarRow(
  snapshot: AdminSaleOperationsSnapshot,
): OnsiteSalesRadarRow | null {
  if (snapshot.sale.deliveryMode !== "onsite") return null;
  const pendingRegistrations = snapshot.registrations.pending;
  const pendingTelephone = snapshot.telephoneBookings.requested;
  const inProgressTelephone = snapshot.telephoneBookings.inProgress;
  if (pendingRegistrations === 0 && pendingTelephone === 0 && inProgressTelephone === 0) {
    return null;
  }
  return {
    saleId: snapshot.sale.id,
    title: snapshot.sale.title,
    status: snapshot.sale.status,
    pendingRegistrations,
    pendingTelephone,
    inProgressTelephone,
  };
}
