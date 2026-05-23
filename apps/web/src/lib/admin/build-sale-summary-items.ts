import type { CatalogDetailSummaryItem } from "@/components/admin/catalog";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import type { Sale } from "@auction/types";

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

export function buildSaleSummaryItems(
  saleId: string,
  sale: Sale,
  lotCount: number,
  aggregateHammer: string,
  liveish: boolean,
  registrationCount: number | null,
): CatalogDetailSummaryItem[] {
  const scheduleStart =
    formatDateTime(sale.startTime).split(",")[0] ?? formatDateTime(sale.startTime);
  const scheduleEnd = formatDateTime(sale.endTime).split(",")[0] ?? formatDateTime(sale.endTime);

  return [
    {
      id: "lots",
      label: "Lots",
      value: lotCount,
      hint: lotCount === 0 ? "Add lots" : "View lot list",
      href: saleDetailTabHref(saleId, "lots"),
    },
    {
      id: "hammer",
      label: "Aggregate hammer",
      value: aggregateHammer,
      hint: "Sum of lot current prices",
    },
    {
      id: "schedule",
      label: "Schedule",
      value: scheduleStart,
      hint: scheduleHint(sale) ?? `Ends ${scheduleEnd}`,
      href: saleDetailTabHref(saleId, "schedule"),
    },
    {
      id: "delivery",
      label: "Delivery",
      value: sale.deliveryMode.charAt(0).toUpperCase() + sale.deliveryMode.slice(1),
      ...(liveish ? { hint: "Open saleroom", href: `/admin/saleroom/${saleId}` } : {}),
    },
    {
      id: "registrations",
      label: "Registrations",
      value: !liveish ? "—" : (registrationCount ?? 0),
      hint: !liveish
        ? "Available when scheduled"
        : registrationCount != null && registrationCount > 0
          ? "View registrations"
          : "No registrations yet",
      ...(liveish ? { href: saleDetailTabHref(saleId, "registrations") } : {}),
    },
  ];
}
