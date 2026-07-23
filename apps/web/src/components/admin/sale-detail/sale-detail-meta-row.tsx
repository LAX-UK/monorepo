import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import type { Sale } from "@auction/types";
import { Calendar, MapPin, Package, Users } from "lucide-react";

type Props = {
  sale: Sale;
  venueLine?: string | null;
  lotCount?: number | null;
  registrationCount?: number | null;
};

/** Location, schedule, lots, and registrations row under sale detail title. */
export function SaleDetailMetaRow({
  sale,
  venueLine,
  lotCount = null,
  registrationCount = null,
}: Props) {
  const location = venueLine?.trim() || sale.locationCity?.trim() || sale.locationName?.trim();

  if (!location && !sale.startTime && lotCount == null && registrationCount == null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-on-surface-variant">
      {location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0 text-secondary" aria-hidden />
          {location}
        </span>
      ) : null}
      {sale.startTime ? (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <Calendar className="size-4 shrink-0 text-secondary" aria-hidden />
          <AdminTableDateTimeCell iso={sale.startTime} mode="deadline" deadlineKind="start" />
          <span aria-hidden>–</span>
          <AdminTableDateTimeCell iso={sale.endTime} mode="deadline" live />
        </span>
      ) : null}
      {lotCount != null ? (
        <span className="inline-flex items-center gap-1.5">
          <Package className="size-4 shrink-0 text-secondary" aria-hidden />
          {lotCount} {lotCount === 1 ? "lot" : "lots"}
        </span>
      ) : null}
      {registrationCount != null ? (
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4 shrink-0 text-secondary" aria-hidden />
          {registrationCount} {registrationCount === 1 ? "registration" : "registrations"}
        </span>
      ) : null}
    </div>
  );
}
