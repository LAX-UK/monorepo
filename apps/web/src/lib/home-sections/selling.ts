import type { HomeSelling } from "@/lib/home-sections/types";
import { LONDON_TIME_ZONE, formatDate, toDate } from "@auction/datetime";
import type { Sale } from "@auction/types";

const SELLING_IMAGES = 2;

/** The sale whose consignment deadline is next, ignoring deadlines already past. */
function nextDeadline(sales: readonly Sale[], now: Date): { sale: Sale; deadline: Date } | null {
  const open = sales
    .flatMap((sale) => {
      const deadline = toDate(sale.consignmentDeadline);
      return deadline && deadline.getTime() > now.getTime() ? [{ sale, deadline }] : [];
    })
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  return open[0] ?? null;
}

/** The selling band always shows; it carries the next consignment deadline when staff set one. */
export function buildSelling(input: {
  scheduledSales: readonly Sale[];
  imageUrls: readonly (string | null | undefined)[];
  now: Date;
}): HomeSelling {
  const next = nextDeadline(input.scheduledSales, input.now);
  return {
    deadlineNote: next
      ? `Consignments for ${next.sale.title} close ${formatDate(next.deadline, LONDON_TIME_ZONE)}`
      : null,
    imageUrls: input.imageUrls
      .filter((url): url is string => typeof url === "string" && url.length > 0)
      .slice(0, SELLING_IMAGES),
  };
}
