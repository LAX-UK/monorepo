import { CatalogKpiCard } from "@/components/admin/catalog/catalog-kpi-card";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import type { Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  lotCount: number;
  aggregateHammer: string;
  liveish: boolean;
  registrationCount: number | null;
};

function scheduleHint(sale: Sale): string | undefined {
  const now = Date.now();
  if (sale.status === "active" && sale.endTime.getTime() > now) {
    return `Ends ${formatRelativeTime(sale.endTime)}`;
  }
  if (sale.status === "scheduled" && sale.startTime.getTime() > now) {
    return `Starts ${formatRelativeTime(sale.startTime)}`;
  }
  return undefined;
}

export function AdminSaleDetailKpiStrip({
  saleId,
  sale,
  lotCount,
  aggregateHammer,
  liveish,
  registrationCount,
}: Props) {
  const scheduleStart =
    formatDateTime(sale.startTime).split(",")[0] ?? formatDateTime(sale.startTime);
  const scheduleEnd = formatDateTime(sale.endTime).split(",")[0] ?? formatDateTime(sale.endTime);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <CatalogKpiCard
        label="Lots"
        value={lotCount}
        hint={lotCount === 0 ? "Add lots" : "View lot list"}
        href={`/admin/sales/${saleId}/lots`}
      />
      <CatalogKpiCard
        label="Aggregate hammer"
        value={aggregateHammer}
        hint="Sum of lot current prices"
      />
      <CatalogKpiCard
        label="Schedule"
        value={<span className="text-base font-medium">{scheduleStart}</span>}
        hint={scheduleHint(sale) ?? `Ends ${scheduleEnd}`}
      />
      <CatalogKpiCard
        label="Delivery"
        value={<span className="capitalize">{sale.deliveryMode}</span>}
        {...(liveish ? { hint: "Open saleroom", href: `/admin/saleroom/${saleId}` } : {})}
      />
      <CatalogKpiCard
        label="Registrations"
        value={!liveish ? "—" : registrationCount == null ? "—" : registrationCount}
        hint={
          !liveish
            ? "Available when scheduled"
            : registrationCount != null && registrationCount > 0
              ? "View registrations"
              : "No registrations yet"
        }
        {...(liveish && registrationCount != null && registrationCount > 0
          ? { href: `/admin/sales/${saleId}/registrations` }
          : {})}
      />
    </div>
  );
}
