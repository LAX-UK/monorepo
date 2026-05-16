import { SalesCalendarGridCard } from "@/components/sections/sales/sales-calendar-grid-card";
import type { CalendarGridCardVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vms: CalendarGridCardVM[];
};

/** Multi-column sale tiles for calendar browse (grid view). */
export function SalesCalendarGrid({ vms }: Props) {
  if (vms.length === 0) return null;

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-6">
      {vms.map((vm, index) => (
        <SalesCalendarGridCard key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
