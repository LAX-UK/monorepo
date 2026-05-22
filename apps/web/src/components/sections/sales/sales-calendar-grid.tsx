import { SalesCalendarGridCard } from "@/components/sections/sales/sales-calendar-grid-card";
import type { CalendarGridCardVM } from "@/components/sections/sales/sales-view-models";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import { cn } from "@auction/ui";

type Props = {
  vms: CalendarGridCardVM[];
};

/** Multi-column sale tiles for calendar browse (grid view). */
export function SalesCalendarGrid({ vms }: Props) {
  if (vms.length === 0) return null;

  return (
    <ul
      className={cn(
        "m-0 list-none gap-3 p-0 md:gap-5 xl:gap-6",
        sparseGridClasses(vms.length, {
          multi: "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3",
        }),
      )}
    >
      {vms.map((vm, index) => (
        <SalesCalendarGridCard key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
