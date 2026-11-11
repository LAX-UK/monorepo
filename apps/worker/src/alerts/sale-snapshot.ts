import type { MatchSnapshot } from "@auction/alerts";
import { formatWeekdayDayMonth } from "@auction/datetime";
import type { AnnouncedSale } from "@auction/persistence/interfaces";

const DELIVERY_LABEL: Record<AnnouncedSale["deliveryMode"], string> = {
  online: "Online",
  onsite: "Live auction",
  hybrid: "Live and online",
};

/** "Wed 18 Nov": the London day an instant falls on. */
export function londonDayLabel(at: Date): string {
  return formatWeekdayDayMonth(at, "Europe/London", { engineSept: true });
}

function lots(count: number): string {
  return `${count} ${count === 1 ? "lot" : "lots"}`;
}

/** What an email and an in-app notice show about a newly announced sale. */
export function saleSnapshot(sale: AnnouncedSale, lotCount: number | null): MatchSnapshot {
  return {
    title: sale.title,
    subtitle: `${DELIVERY_LABEL[sale.deliveryMode]} · opens ${londonDayLabel(sale.startTime)}, closes ${londonDayLabel(sale.endTime)}`,
    ...(lotCount !== null ? { detail: lots(lotCount) } : {}),
    path: `/sales/${sale.id}`,
  };
}

/** The in-app notice for the same sale. */
export function saleNotice(sale: AnnouncedSale, lotCount: number | null) {
  return {
    saleId: sale.id,
    title: `New sale: ${sale.title}`,
    message: `Opens ${londonDayLabel(sale.startTime)}${lotCount !== null ? ` · ${lots(lotCount)}` : ""}`,
  };
}
